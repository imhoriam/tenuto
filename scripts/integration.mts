/**
 * Full-path integration test against a real (throwaway) database.
 *
 * Unit tests pin the state machine in isolation; this proves the invariants
 * survive contact with Prisma, transactions and the payment provider. Run with
 * `npm run test:integration`.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "tenuto-it-"));
const dbPath = join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbPath}`;

execSync("npx prisma migrate deploy", {
  stdio: "pipe",
  env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
});

const { db } = await import("../src/lib/db");
const {
  BOOKING_STATUS,
  CHARGE_STATUS,
  DISPUTE_STATUS,
  PAYOUT_STATUS,
  DISPUTE_WINDOW_DAYS,
  CHECKIN_METHOD,
  REQUIREMENT,
  RESOURCE_KIND,
  VERTICAL,
} = await import("../src/lib/constants");
const {
  createBooking,
  markNoShow,
  checkIn,
  collectDueCharges,
  sweepNoShows,
  openDispute,
  resolveDispute,
  releaseDuePayouts,
  setSuspended,
  waive,
  BookingError,
} = await import("../src/lib/booking/service");
const { ForbiddenActorError } = await import("../src/lib/booking/state-machine");
const { sendBookingConfirmation } = await import("../src/lib/notifications/deliver");
const { isGsm7 } = await import("../src/lib/notifications/messages");

const MIN = 60_000;
const HOUR = 60 * MIN;

let passed = 0;
const failures: string[] = [];

async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✔ ${name}`);
    passed += 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✖ ${name}\n      ${msg}`);
    failures.push(name);
  }
}

async function setup() {
  const business = await db.business.create({
    data: {
      slug: "test-venue",
      name: "Test Venue",
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

  // Open every day, all day, so slot rules never get in the way here.
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

/** Bookings must be in the future to be created; move them back afterwards. */
async function backdate(bookingId: string, startAt: Date) {
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const span = b.endAt.getTime() - b.startAt.getTime();
  await db.booking.update({
    where: { id: bookingId },
    data: { startAt, endAt: new Date(startAt.getTime() + span) },
  });
}

async function book(
  ctx: Awaited<ReturnType<typeof setup>>,
  over: { phone: string; name: string; startAt: Date; card?: string; partySize?: number },
) {
  return createBooking({
    businessSlug: ctx.business.slug,
    serviceId: ctx.service.id,
    resourceId: ctx.table.id,
    startAt: over.startAt,
    partySize: over.partySize ?? 2,
    customerName: over.name,
    customerPhone: over.phone,
    cardToken: over.card ?? "4242424242424242",
    policyTextShown: "Test policy text.",
  });
}

async function main() {
  console.log("\nIntegration — full booking and charge path\n");
  const ctx = await setup();

  await step("a first-timer must leave a card, and the booking confirms", async () => {
    const { booking, policy, card } = await book(ctx, {
      phone: "+40700000001",
      name: "First Timer",
      startAt: new Date(Date.now() + 3 * HOUR),
    });
    assert.equal(policy.requirement, REQUIREMENT.CARD_ON_FILE);
    assert.equal(policy.feeCents, 5000);
    assert.equal(booking.status, BOOKING_STATUS.CONFIRMED);
    assert.equal(card?.cardLast4, "4242");
  });

  await step("the policy snapshot is written verbatim", async () => {
    const snap = await db.policySnapshot.findFirstOrThrow({
      orderBy: { acceptedAt: "desc" },
    });
    assert.equal(snap.policyText, "Test policy text.");
    assert.equal(snap.feeCents, 5000);
    assert.equal(snap.gracePeriodMin, 15);
  });

  await step("double-booking the same table is refused", async () => {
    const startAt = new Date(Date.now() + 10 * HOUR);
    await book(ctx, { phone: "+40700000002", name: "A", startAt });
    await assert.rejects(
      () => book(ctx, { phone: "+40700000003", name: "B", startAt }),
      (err: unknown) =>
        err instanceof BookingError && err.code === "slot_taken",
    );
  });

  await step("a booking inside the grace window cannot be marked absent", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000004",
      name: "Slightly Late",
      startAt: new Date(Date.now() + 20 * HOUR),
    });
    await backdate(booking.id, new Date(Date.now() - 5 * MIN)); // 5 min late

    await assert.rejects(
      () => markNoShow({ bookingId: booking.id, actorLabel: "staff" }),
      (err: unknown) =>
        err instanceof BookingError && err.code === "grace_period",
    );
  });

  await step("past the grace window, marking absent moves no money by itself", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000005",
      name: "No Show",
      startAt: new Date(Date.now() + 30 * HOUR),
    });
    await backdate(booking.id, new Date(Date.now() - 40 * MIN));

    const marked = await markNoShow({ bookingId: booking.id, actorLabel: "staff" });
    assert.equal(marked.status, BOOKING_STATUS.NO_SHOW_PENDING);
    // Collectable at once — the grace period was the only hold — but marking
    // is not charging: money moves only when collection runs.
    assert.ok(marked.chargeableAt && marked.chargeableAt.getTime() <= Date.now());

    // No money has moved yet.
    assert.equal(await db.charge.count({ where: { bookingId: booking.id } }), 0);
  });

  await step("the charge fires when collection runs", async () => {
    const booking = await db.booking.findFirstOrThrow({
      where: { status: BOOKING_STATUS.NO_SHOW_PENDING },
    });

    const results = await collectDueCharges();
    assert.equal(results.length, 1);
    assert.equal(results[0].outcome, "charged");

    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(after.status, BOOKING_STATUS.CHARGE_SUCCEEDED);

    const charge = await db.charge.findFirstOrThrow({
      where: { bookingId: booking.id },
    });
    assert.equal(charge.status, CHARGE_STATUS.SUCCEEDED);
    assert.equal(charge.amountCents, 5000);
  });

  await step("re-running collection does not charge twice", async () => {
    const before = await db.charge.count();
    await collectDueCharges();
    await collectDueCharges();
    assert.equal(await db.charge.count(), before);
  });

  await step("the late arrival is rescued by checking in", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000006",
      name: "Late But Present",
      startAt: new Date(Date.now() + 50 * HOUR),
    });
    await backdate(booking.id, new Date(Date.now() - 25 * MIN));

    await markNoShow({ bookingId: booking.id, actorLabel: "staff" });

    // They walk in.
    const rescued = await checkIn({
      bookingId: booking.id,
      method: CHECKIN_METHOD.MANUAL,
      actorLabel: "host",
    });
    assert.equal(rescued.status, BOOKING_STATUS.CHECKED_IN);
    assert.equal(rescued.chargeableAt, null);

    // And the collector must now ignore them entirely.
    await collectDueCharges();
    assert.equal(await db.charge.count({ where: { bookingId: booking.id } }), 0);
  });

  await step("a hard decline is not retried", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000007",
      name: "Declined",
      startAt: new Date(Date.now() + 70 * HOUR),
      card: "4000000000000002",
    });
    await backdate(booking.id, new Date(Date.now() - 40 * MIN));
    await markNoShow({ bookingId: booking.id, actorLabel: "staff" });
    await db.booking.update({
      where: { id: booking.id },
      data: { chargeableAt: new Date(Date.now() - MIN) },
    });

    await collectDueCharges();

    const charge = await db.charge.findFirstOrThrow({
      where: { bookingId: booking.id },
    });
    assert.equal(charge.status, CHARGE_STATUS.UNCOLLECTIBLE);
    assert.equal(charge.nextRetryAt, null);
    assert.match(charge.lastError ?? "", /card_declined/);
  });

  await step("a soft decline schedules a retry", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000008",
      name: "No Funds",
      startAt: new Date(Date.now() + 90 * HOUR),
      card: "4000000000009995",
    });
    await backdate(booking.id, new Date(Date.now() - 40 * MIN));
    await markNoShow({ bookingId: booking.id, actorLabel: "staff" });
    await db.booking.update({
      where: { id: booking.id },
      data: { chargeableAt: new Date(Date.now() - MIN) },
    });

    await collectDueCharges();

    const charge = await db.charge.findFirstOrThrow({
      where: { bookingId: booking.id },
    });
    assert.equal(charge.status, CHARGE_STATUS.FAILED);
    assert.ok(charge.nextRetryAt, "a retry must be scheduled");
    assert.match(charge.lastError ?? "", /insufficient_funds/);
  });

  await step("a regular books with no card at all", async () => {
    const phone = "+40700000009";
    const customer = await db.customer.create({
      data: { phone, name: "Regular", completedCount: 9 },
    });
    await db.customerProfile.create({
      data: {
        businessId: ctx.business.id,
        customerId: customer.id,
        completedCount: 9,
      },
    });

    const { booking, policy, card } = await createBooking({
      businessSlug: ctx.business.slug,
      serviceId: ctx.service.id,
      resourceId: ctx.table.id,
      startAt: new Date(Date.now() + 110 * HOUR),
      partySize: 2,
      customerName: "Regular",
      customerPhone: phone,
      policyTextShown: "No card needed.",
      // deliberately no cardToken
    });

    assert.equal(policy.requirement, REQUIREMENT.NONE);
    assert.equal(policy.feeCents, 0);
    assert.equal(card, null);
    assert.equal(booking.feeCents, 0);
    assert.equal(await db.mandate.count({ where: { bookingId: booking.id } }), 0);
  });


  // --- automatic no-show ----------------------------------------------------

  await step("once grace ends with no check-in, the system records the no-show", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000020",
      name: "Auto Absent",
      startAt: new Date(Date.now() + 210 * HOUR),
    });
    const startAt = new Date(Date.now() - 20 * MIN); // 15 min grace has run out
    await backdate(booking.id, startAt);

    const marked = await sweepNoShows({ businessId: ctx.business.id });
    assert.ok(marked.includes(booking.reference));

    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(after.status, BOOKING_STATUS.NO_SHOW_PENDING);
    // Collectable the moment the grace period ends — there is no other hold.
    assert.equal(after.chargeableAt?.getTime(), startAt.getTime() + 15 * MIN);
    assert.equal(await db.charge.count({ where: { bookingId: booking.id } }), 0, "no money moves");

    const event = await db.bookingEvent.findFirstOrThrow({
      where: { bookingId: booking.id, toStatus: BOOKING_STATUS.NO_SHOW_PENDING },
    });
    assert.equal(event.actorType, "system", "a clock ran out; nobody asserted anything");
  });

  await step("the sweep leaves a booking inside its grace period alone", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000021",
      name: "Five Late",
      startAt: new Date(Date.now() + 230 * HOUR),
    });
    await backdate(booking.id, new Date(Date.now() - 5 * MIN));

    await sweepNoShows({ businessId: ctx.business.id });
    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(after.status, BOOKING_STATUS.CONFIRMED);
  });

  await step("the grace the customer agreed to wins over a later, shorter one", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000022",
      name: "Agreed To Fifteen",
      startAt: new Date(Date.now() + 250 * HOUR),
    });
    await backdate(booking.id, new Date(Date.now() - 10 * MIN));

    // The restaurant cuts its grace to 5 minutes after this booking was made.
    await db.business.update({ where: { id: ctx.business.id }, data: { gracePeriodMin: 5 } });
    try {
      await sweepNoShows({ businessId: ctx.business.id });
      const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
      assert.equal(after.status, BOOKING_STATUS.CONFIRMED, "10 min late is inside the 15 min they accepted");
    } finally {
      await db.business.update({ where: { id: ctx.business.id }, data: { gracePeriodMin: 15 } });
    }
  });

  // --- arrival by name ------------------------------------------------------

  await step("the host marking someone arrived rescues an automatic no-show", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000024",
      name: "Late, Gave Name",
      startAt: new Date(Date.now() + 290 * HOUR),
    });
    await backdate(booking.id, new Date(Date.now() - 30 * MIN));
    await sweepNoShows({ businessId: ctx.business.id });
    assert.equal(
      (await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
      BOOKING_STATUS.NO_SHOW_PENDING,
    );

    await checkIn({ bookingId: booking.id, method: CHECKIN_METHOD.MANUAL, actorLabel: "host" });

    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(after.status, BOOKING_STATUS.CHECKED_IN);
    assert.equal(after.chargeableAt, null);

    await collectDueCharges(new Date(Date.now() + 24 * HOUR), { businessId: ctx.business.id });
    assert.equal(await db.charge.count({ where: { bookingId: booking.id } }), 0);

    const event = await db.bookingEvent.findFirstOrThrow({
      where: { bookingId: booking.id, toStatus: BOOKING_STATUS.CHECKED_IN },
    });
    assert.equal(event.actorType, "business");
    assert.equal(event.actorLabel, "host", "who confirmed the arrival is on the record");

    // Tapping twice is harmless.
    const again = await checkIn({ bookingId: booking.id, method: CHECKIN_METHOD.MANUAL, actorLabel: "host" });
    assert.equal(again.status, BOOKING_STATUS.CHECKED_IN);
  });

  await step("an arrival cannot be recorded on a booking already charged", async () => {
    const charged = await db.booking.findFirstOrThrow({ where: { status: BOOKING_STATUS.CHARGE_SUCCEEDED } });
    await assert.rejects(() => checkIn({ bookingId: charged.id, method: CHECKIN_METHOD.MANUAL, actorLabel: "host" }));
  });

  // --- charge button --------------------------------------------------------

  await step("the charge button only touches its own restaurant", async () => {
    const other = await db.business.create({
      data: {
        slug: "other-venue",
        name: "Other Venue",
        vertical: VERTICAL.RESTAURANT,
        locations: { create: { name: "Main" } },
        services: { create: { name: "Dinner", durationMin: 120, usesPartySize: true } },
        resources: { create: { name: "O1", capacity: 4 } },
        scheduleRules: { create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 0, endMinute: 1439 })) },
        policyRules: { create: { name: "Card", priority: 100, requirement: REQUIREMENT.CARD_ON_FILE } },
      },
      include: { services: true, resources: true },
    });
    const { booking } = await createBooking({
      businessSlug: other.slug,
      serviceId: other.services[0].id,
      resourceId: other.resources[0].id,
      startAt: new Date(Date.now() + 5 * HOUR),
      partySize: 2,
      customerName: "Elsewhere",
      customerPhone: "+40700000026",
      cardToken: "4242424242424242",
      policyTextShown: "Other policy.",
    });
    await backdate(booking.id, new Date(Date.now() - 4 * HOUR));
    await sweepNoShows({ businessId: other.id });

    await collectDueCharges(new Date(), { businessId: ctx.business.id });
    assert.equal(await db.charge.count({ where: { bookingId: booking.id } }), 0, "not ours to charge");

    const theirs = await collectDueCharges(new Date(), { businessId: other.id });
    assert.deepEqual(theirs.map((r) => r.reference), [booking.reference]);
  });

  await step("a soft decline is actually retried when due, then given up", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000027",
      name: "Still No Funds",
      startAt: new Date(Date.now() + 330 * HOUR),
      card: "4000000000009995",
    });
    await backdate(booking.id, new Date(Date.now() - 4 * HOUR));
    await sweepNoShows({ businessId: ctx.business.id });

    const scope = { businessId: ctx.business.id };
    let now = new Date();
    await collectDueCharges(now, scope);

    for (const expectedAttempts of [2, 3]) {
      const b = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
      assert.ok(b.chargeableAt, `retry ${expectedAttempts} must be scheduled`);
      now = new Date(b.chargeableAt!.getTime() + MIN);
      await collectDueCharges(now, scope);
      assert.equal(await db.charge.count({ where: { bookingId: booking.id } }), expectedAttempts);
    }

    const last = await db.charge.findFirstOrThrow({ where: { bookingId: booking.id }, orderBy: { attempt: "desc" } });
    assert.equal(last.status, CHARGE_STATUS.UNCOLLECTIBLE, "the ladder stops after +24h and +72h");
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).chargeableAt, null);

    await collectDueCharges(new Date(now.getTime() + 30 * 24 * HOUR), scope);
    assert.equal(await db.charge.count({ where: { bookingId: booking.id } }), 3, "and never tries again");
  });

  // --- the table is released at the end of grace ------------------------------

  await step("once grace ends, the table can be booked by someone else", async () => {
    // Fresh restaurant with one table, so nothing else competes for it.
    const solo = await db.business.create({
      data: {
        slug: "solo-table",
        name: "Solo",
        vertical: VERTICAL.RESTAURANT,
        locations: { create: { name: "Main" } },
        services: { create: { name: "Dinner", durationMin: 120, usesPartySize: true } },
        resources: { create: { name: "S1", capacity: 4 } },
        scheduleRules: { create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 0, endMinute: 1439 })) },
        policyRules: { create: { name: "Card", priority: 100, requirement: REQUIREMENT.CARD_ON_FILE } },
      },
      include: { services: true, resources: true },
    });
    const bookSolo = (phone: string, startAt: Date) =>
      createBooking({
        businessSlug: solo.slug,
        serviceId: solo.services[0].id,
        resourceId: solo.resources[0].id,
        startAt,
        partySize: 2,
        customerName: phone,
        customerPhone: phone,
        cardToken: "4242424242424242",
        policyTextShown: "Solo policy.",
      });

    const { booking } = await bookSolo("+40700000030", new Date(Date.now() + 2 * HOUR));
    await backdate(booking.id, new Date(Date.now() - 20 * MIN)); // grace (15 min) is over

    // Before the sweep the no-show still holds the table…
    await assert.rejects(
      () => bookSolo("+40700000031", new Date(Date.now() + 30 * MIN)),
      (err: unknown) => err instanceof BookingError && err.code === "slot_taken",
    );
    // …after it, the table is free again.
    await sweepNoShows({ businessId: solo.id });
    const { booking: walkIn } = await bookSolo("+40700000031", new Date(Date.now() + 30 * MIN));
    assert.equal(walkIn.status, BOOKING_STATUS.CONFIRMED);
  });

  // --- held money and disputes -----------------------------------------------

  /** A booking that no-showed and was charged just now; money is held. */
  async function chargedBooking(phone: string, hoursAhead: number) {
    const { booking } = await book(ctx, { phone, name: phone, startAt: new Date(Date.now() + hoursAhead * HOUR) });
    await backdate(booking.id, new Date(Date.now() - 3 * HOUR));
    await sweepNoShows({ businessId: ctx.business.id });
    await collectDueCharges(new Date(), { businessId: ctx.business.id });
    return db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { charges: true } });
  }

  await step("a collected fee is held for the dispute window, not paid out", async () => {
    const b = await chargedBooking("+40700000040", 400);
    assert.equal(b.status, BOOKING_STATUS.CHARGE_SUCCEEDED);
    const charge = b.charges[0];
    assert.equal(charge.payoutStatus, PAYOUT_STATUS.HELD);
    const days = (charge.payoutReleaseAt!.getTime() - charge.succeededAt!.getTime()) / (24 * HOUR);
    assert.ok(Math.abs(days - DISPUTE_WINDOW_DAYS) < 0.01);

    // Nothing is released early…
    await releaseDuePayouts({ businessId: ctx.business.id });
    assert.equal((await db.charge.findUniqueOrThrow({ where: { id: charge.id } })).payoutStatus, PAYOUT_STATUS.HELD);
    // …and it is released once the window has passed undisputed.
    await releaseDuePayouts({ businessId: ctx.business.id, now: new Date(charge.payoutReleaseAt!.getTime() + MIN) });
    assert.equal((await db.charge.findUniqueOrThrow({ where: { id: charge.id } })).payoutStatus, PAYOUT_STATUS.RELEASED);
  });

  await step("the customer disputes with one tap, and the money freezes", async () => {
    const b = await chargedBooking("+40700000041", 420);
    const dispute = await openDispute({ accessToken: b.accessToken!, reason: "Am fost acolo la 20:05." });
    assert.equal(dispute.status, DISPUTE_STATUS.OPEN);

    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id }, include: { charges: true } });
    assert.equal(after.status, BOOKING_STATUS.DISPUTED);
    assert.equal(after.charges[0].payoutStatus, PAYOUT_STATUS.FROZEN);

    // Frozen money is never released by the window passing.
    await releaseDuePayouts({ businessId: ctx.business.id, now: new Date(Date.now() + 60 * 24 * HOUR) });
    assert.equal((await db.charge.findUniqueOrThrow({ where: { id: after.charges[0].id } })).payoutStatus, PAYOUT_STATUS.FROZEN);

    // A second tap changes nothing.
    const again = await openDispute({ accessToken: b.accessToken! });
    assert.equal(again.id, dispute.id);

    const event = await db.bookingEvent.findFirstOrThrow({ where: { bookingId: b.id, toStatus: BOOKING_STATUS.DISPUTED } });
    assert.equal(event.actorType, "customer");
  });

  await step("the restaurant cannot rule in its own favour", async () => {
    const b = await db.booking.findFirstOrThrow({ where: { customer: { phone: "+40700000041" } } });
    await assert.rejects(
      () => resolveDispute({ bookingId: b.id, outcome: "uphold", actor: "business" }),
      ForbiddenActorError,
    );
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status, BOOKING_STATUS.DISPUTED);
  });

  await step("the restaurant can refund a dispute, and the money really goes back", async () => {
    const b = await db.booking.findFirstOrThrow({ where: { customer: { phone: "+40700000041" } } });
    await waive({ bookingId: b.id, actorLabel: "staff" });

    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id }, include: { charges: true, dispute: true } });
    assert.equal(after.status, BOOKING_STATUS.WAIVED);
    assert.equal(after.charges[0].status, CHARGE_STATUS.REFUNDED);
    assert.equal(after.charges[0].payoutStatus, PAYOUT_STATUS.REFUNDED);
    assert.ok(after.charges[0].refundRef, "the provider refund is on record");
    assert.equal(after.dispute?.status, DISPUTE_STATUS.REFUNDED);
    assert.equal(after.dispute?.resolvedBy, "business");
  });

  await step("the platform can uphold a dispute, which releases the money", async () => {
    const b = await chargedBooking("+40700000042", 440);
    await openDispute({ accessToken: b.accessToken! });
    await resolveDispute({ bookingId: b.id, outcome: "uphold", actor: "platform", actorLabel: "admin", note: "Sosirea nu apare." });

    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id }, include: { charges: true, dispute: true } });
    assert.equal(after.status, BOOKING_STATUS.CHARGE_SUCCEEDED);
    assert.equal(after.charges[0].payoutStatus, PAYOUT_STATUS.RELEASED);
    assert.equal(after.dispute?.status, DISPUTE_STATUS.UPHELD);
    assert.equal(after.dispute?.resolution, "Sosirea nu apare.");
  });

  await step("a dispute after the window, or of an uncollected fee, is refused", async () => {
    const b = await chargedBooking("+40700000043", 460);
    await assert.rejects(
      () => openDispute({ accessToken: b.accessToken!, now: new Date(Date.now() + (DISPUTE_WINDOW_DAYS + 1) * 24 * HOUR) }),
      (err: unknown) => err instanceof BookingError && err.code === "dispute_window_closed",
    );
    const { booking: upcoming } = await book(ctx, { phone: "+40700000044", name: "Upcoming", startAt: new Date(Date.now() + 480 * HOUR) });
    await assert.rejects(
      () => openDispute({ accessToken: upcoming.accessToken! }),
      (err: unknown) => err instanceof BookingError && err.code === "not_charged",
    );
  });

  await step("waiving a fee that was already collected refunds it", async () => {
    const b = await chargedBooking("+40700000045", 500);
    await waive({ bookingId: b.id, actorLabel: "staff" });
    const charge = await db.charge.findUniqueOrThrow({ where: { id: b.charges[0].id } });
    assert.equal(charge.status, CHARGE_STATUS.REFUNDED);
  });

  await step("a suspended restaurant takes no bookings and collects nothing", async () => {
    const { booking } = await book(ctx, { phone: "+40700000046", name: "Before Suspension", startAt: new Date(Date.now() + 520 * HOUR) });
    await backdate(booking.id, new Date(Date.now() - 3 * HOUR));
    await sweepNoShows({ businessId: ctx.business.id });

    await setSuspended({ businessId: ctx.business.id, suspended: true });
    try {
      await assert.rejects(
        () => book(ctx, { phone: "+40700000047", name: "Blocked", startAt: new Date(Date.now() + 540 * HOUR) }),
        (err: unknown) => err instanceof BookingError && err.code === "suspended",
      );
      await collectDueCharges(new Date(), { businessId: ctx.business.id });
      assert.equal(await db.charge.count({ where: { bookingId: booking.id } }), 0);
    } finally {
      await setSuspended({ businessId: ctx.business.id, suspended: false });
    }
  });

  // --- confirmation SMS ------------------------------------------------------

  await step("the customer is texted where, when, and the link to their QR", async () => {
    const sent: { to: string; body: string }[] = [];
    const fake = { name: "fake", send: async (m: { to: string; body: string }) => (sent.push(m), { ok: true as const, providerRef: "SM123" }) };

    const { booking } = await book(ctx, { phone: "0722 555 000", name: "Texted", startAt: new Date(Date.now() + 600 * HOUR) });
    const n = await sendBookingConfirmation({ bookingId: booking.id, baseUrl: "https://tenuto.ro/", provider: fake });

    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "+40722555000", "typed local number is sent as E.164");
    assert.match(sent[0].body, /Test Venue/);
    assert.match(sent[0].body, /15 min/);
    assert.ok(sent[0].body.includes(`https://tenuto.ro/r/${booking.accessToken}`), "links to the customer's own page");
    assert.equal(isGsm7(sent[0].body), true);

    assert.equal(n?.status, "sent");
    assert.equal(n?.providerRef, "SM123");
    assert.equal(n?.body, sent[0].body, "the row records exactly what was sent");
  });

  await step("a failed SMS is recorded, and the booking stands", async () => {
    const failing = { name: "fake", send: async () => ({ ok: false as const, error: "carrier rejected" }) };
    const { booking } = await book(ctx, { phone: "+40722555001", name: "Unlucky", startAt: new Date(Date.now() + 620 * HOUR) });
    const n = await sendBookingConfirmation({ bookingId: booking.id, baseUrl: "https://tenuto.ro", provider: failing });

    assert.equal(n?.status, "failed");
    assert.equal(n?.error, "carrier rejected");
    assert.equal((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, BOOKING_STATUS.CONFIRMED);
  });

  await step("every transition left an audit trail", async () => {
    const orphan = await db.booking.findFirst({
      where: { events: { none: {} } },
    });
    assert.equal(orphan, null, "every booking must have at least one event");
  });

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });
