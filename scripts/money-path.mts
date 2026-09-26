/**
 * The money path, narrated, against a throwaway database.
 *
 * `npm run money` walks one booking from card-on-file to collected fee and
 * prints the state after every step, so the invariants in CLAUDE.md §7 can be
 * watched rather than inferred from a passing test.
 *
 * Pass a card to pick the outcome (mock provider mirrors Stripe's test cards):
 *
 *   npm run money                        4242… succeeds
 *   npm run money -- 4000000000009995    soft decline, retry scheduled
 *   npm run money -- 4000000000000002    hard decline, never retried
 *   npm run money -- --rescue            host marks a late arrival in, no charge
 */
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "tenuto-money-"));
const dbPath = join(dir, "money.db");
process.env.DATABASE_URL = `file:${dbPath}`;

execSync("npx prisma migrate deploy", {
  stdio: "pipe",
  env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
});

const { db } = await import("../src/lib/db");
const { CHECKIN_METHOD, REQUIREMENT, RESOURCE_KIND, VERTICAL } =
  await import("../src/lib/constants");
const { createBooking, markNoShow, checkIn, collectDueCharges, BookingError } =
  await import("../src/lib/booking/service");
const { money } = await import("../src/lib/format");

const args = process.argv.slice(2);
const rescue = args.includes("--rescue");
const card = args.find((a) => /^\d{12,19}$/.test(a)) ?? "4242424242424242";

const MIN = 60_000;
const HOUR = 60 * MIN;

let n = 0;
const step = (title: string) => console.log(`\n\x1b[1m${++n}. ${title}\x1b[0m`);
const say = (k: string, v: unknown) =>
  console.log(`     ${k.padEnd(18)} \x1b[36m${v}\x1b[0m`);
const note = (s: string) => console.log(`     \x1b[2m${s}\x1b[0m`);

async function ledger(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { charges: { orderBy: { attempt: "asc" } }, mandate: true },
  });
  say("status", b.status);
  say("chargeableAt", b.chargeableAt?.toISOString() ?? "— (nothing scheduled)");
  for (const c of b.charges) {
    say(
      `charge #${c.attempt}`,
      `${c.status} ${money(c.amountCents, c.currency)}` +
        (c.lastError ? ` — ${c.lastError}` : "") +
        (c.nextRetryAt ? ` — retry at ${c.nextRetryAt.toISOString()}` : ""),
    );
    say("  idempotencyKey", c.idempotencyKey);
  }
  return b;
}

async function setup() {
  const business = await db.business.create({
    data: {
      slug: "money-demo",
      name: "Money Demo",
      vertical: VERTICAL.RESTAURANT,
      timezone: "Europe/Bucharest",
      currency: "RON",
      gracePeriodMin: 15,
      cancellationWindowHours: 24,
      noShowFeeCents: 5000,
      locations: { create: { name: "Main" } },
    },
    include: { locations: true },
  });

  const service = await db.service.create({
    data: {
      businessId: business.id,
      name: "Dinner",
      durationMin: 120,
      bufferAfterMin: 15,
      usesPartySize: true,
    },
  });

  const table = await db.resource.create({
    data: {
      businessId: business.id,
      locationId: business.locations[0].id,
      name: "T1",
      kind: RESOURCE_KIND.TABLE,
      capacity: 4,
    },
  });

  for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
    await db.scheduleRule.create({
      data: { businessId: business.id, weekday, startMinute: 0, endMinute: 1439 },
    });
  }

  await db.policyRule.createMany({
    data: [
      {
        businessId: business.id,
        name: "Regulars free",
        priority: 10,
        minCompletedHere: 3,
        requirement: REQUIREMENT.NONE,
      },
      {
        businessId: business.id,
        name: "Default card",
        priority: 100,
        requirement: REQUIREMENT.CARD_ON_FILE,
      },
    ],
  });

  return { business, service, table };
}

async function main() {
  console.log(
    `\n\x1b[1mTenuto — the money path\x1b[0m  \x1b[2m(card ••••${card.slice(-4)}${rescue ? ", rescue" : ""})\x1b[0m`,
  );
  const ctx = await setup();

  // -------------------------------------------------------------------
  step("Booking made — the card is saved, no money moves");
  const startAt = new Date(Date.now() + 3 * HOUR);
  const { booking, policy, card: saved } = await createBooking({
    businessSlug: ctx.business.slug,
    serviceId: ctx.service.id,
    resourceId: ctx.table.id,
    startAt,
    partySize: 2,
    customerName: "Ana Pop",
    customerPhone: "+40700000001",
    cardToken: card,
    policyTextShown:
      "Nu se ia nimic acum. Dacă nu ajungi, vei fi taxat 50 RON.",
  });

  const withMandate = await db.booking.findUniqueOrThrow({
    where: { id: booking.id },
    include: { mandate: true, policySnapshot: true },
  });

  say("reference", booking.reference);
  say("matched rule", `${policy.matchedRuleName} (priority wins, first match)`);
  say("requirement", booking.requirement);
  say("fee if no-show", money(booking.feeCents, ctx.business.currency));
  say("status", booking.status);
  say("card saved", `${saved?.cardBrand} ••••${saved?.cardLast4}`);
  say("3DS passed", String(saved?.threeDSPassed));
  say("setupIntent", withMandate.mandate?.setupIntentRef ?? "—");
  say("policy stored", `"${withMandate.policySnapshot?.policyText}"`);
  say("charges so far", (await db.charge.count({ where: { bookingId: booking.id } })).toString());
  note("SetupIntent + 3DS only. No PaymentIntent, no processing fee, nothing to refund.");

  // -------------------------------------------------------------------
  step("The business tries to mark them absent immediately — refused");
  try {
    await markNoShow({ bookingId: booking.id, actorLabel: "host" });
    console.log("     \x1b[31mBUG: this should not have been allowed\x1b[0m");
  } catch (err) {
    say("rejected", err instanceof BookingError ? err.message : String(err));
    note("Invariant 4: the grace period is enforced in code, not advisory.");
  }

  // -------------------------------------------------------------------
  step("Time passes — the booking time and the 15 min grace both elapse");
  const past = new Date(Date.now() - 1 * HOUR);
  const span = booking.endAt.getTime() - booking.startAt.getTime();
  await db.booking.update({
    where: { id: booking.id },
    data: { startAt: past, endAt: new Date(past.getTime() + span) },
  });
  say("startAt", `${past.toISOString()}  (an hour ago)`);
  say("markable from", new Date(past.getTime() + 15 * MIN).toISOString());

  // -------------------------------------------------------------------
  step("Grace is over — the no-show is recorded, the table is freed, no money moves yet");
  await markNoShow({ bookingId: booking.id, actorLabel: "host" });
  const marked = await ledger(booking.id);
  say("charges so far", marked.charges.length.toString());
  note("Collectable now: the grace period is the only hold. Money moves only when collection runs.");

  if (rescue) {
    // -----------------------------------------------------------------
    step("They walk in at last — the host marks them arrived");
    await checkIn({ bookingId: booking.id, method: CHECKIN_METHOD.MANUAL, actorLabel: "host" });
    await ledger(booking.id);
    note("Invariant 3: an arrival wins right up until the charge fires.");

    step("Collection runs — there is nothing left to take");
    const after = await collectDueCharges(new Date());
    say("collected", after.length === 0 ? "nothing due" : JSON.stringify(after));
    say("total charged", money(0, ctx.business.currency));
    return;
  }

  // -------------------------------------------------------------------
  step("The restaurant runs collection — the off-session charge fires");
  const afterWindow = new Date();
  const collected = await collectDueCharges(afterWindow);
  say("job returned", JSON.stringify(collected[0] ?? "nothing"));
  const charged = await ledger(booking.id);
  const held = charged.charges.find((c) => c.payoutStatus === "held");
  if (held?.payoutReleaseAt) {
    say("payout", `held until ${held.payoutReleaseAt.toISOString()} — disputable until then`);
  }

  // -------------------------------------------------------------------
  step("The job runs again — it must not charge twice");
  const before = await db.charge.count({ where: { bookingId: booking.id } });
  await collectDueCharges(new Date(afterWindow.getTime() + 1 * MIN));
  const after = await db.charge.count({ where: { bookingId: booking.id } });
  say("charges before", before.toString());
  say("charges after", after.toString());
  note(
    before === after
      ? "Invariant 7: Charge.idempotencyKey is unique at the DB level."
      : "\x1b[31mBUG: a re-run created another charge row\x1b[0m",
  );

  // -------------------------------------------------------------------
  const failed = await db.charge.findFirst({
    where: { bookingId: booking.id, nextRetryAt: { not: null } },
  });
  if (failed?.nextRetryAt) {
    step("Past the scheduled retry — does the retry ladder actually climb?");
    const attemptsBefore = await db.charge.count({ where: { bookingId: booking.id } });
    const past = new Date(failed.nextRetryAt.getTime() + 1 * MIN);
    const retried = await collectDueCharges(past);
    const attemptsAfter = await db.charge.count({ where: { bookingId: booking.id } });
    say("ran at", past.toISOString());
    say("job returned", retried.length === 0 ? "nothing due" : JSON.stringify(retried));
    say("attempts", `${attemptsBefore} → ${attemptsAfter}`);
    note(
      attemptsAfter > attemptsBefore
        ? "The retry fired."
        : "\x1b[31mThe retry never fires: collectDueCharges only queries\n     " +
          "no_show_pending / cancelled_late, so a charge_failed booking is\n     " +
          "never read again. See service.ts:477.\x1b[0m",
    );
  }

  // -------------------------------------------------------------------
  step("The audit trail");
  const events = await db.bookingEvent.findMany({
    where: { bookingId: booking.id },
    orderBy: { at: "asc" },
  });
  for (const e of events) {
    console.log(
      `     \x1b[2m${e.at.toISOString()}\x1b[0m  ` +
        `${(e.fromStatus ?? "—").padEnd(16)} → ${String(e.toStatus).padEnd(16)} ` +
        `\x1b[2m${e.actorType}${e.actorLabel ? ` (${e.actorLabel})` : ""}` +
        `${e.reason ? ` · ${e.reason}` : ""}\x1b[0m`,
    );
  }

  const total = await db.charge.aggregate({
    where: { bookingId: booking.id, status: "succeeded" },
    _sum: { amountCents: true },
  });
  console.log(
    `\n   \x1b[1mMoney actually taken: ${money(total._sum.amountCents ?? 0, ctx.business.currency)}\x1b[0m\n`,
  );
}

try {
  await main();
} finally {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
}
