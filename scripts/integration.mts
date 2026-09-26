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
  CHECKIN_METHOD,
  REQUIREMENT,
  RESOURCE_KIND,
  VERTICAL,
} = await import("../src/lib/constants");
const { createBooking, markNoShow, checkIn, collectDueCharges, BookingError } =
  await import("../src/lib/booking/service");
const { venueKey } = await import("../src/lib/checkin");
const { checkInAtVenue } = await import("../src/app/checkin/[locationId]/actions");

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

  await step("past the grace window, marking absent only starts a clock", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000005",
      name: "No Show",
      startAt: new Date(Date.now() + 30 * HOUR),
    });
    await backdate(booking.id, new Date(Date.now() - 40 * MIN));

    const marked = await markNoShow({ bookingId: booking.id, actorLabel: "staff" });
    assert.equal(marked.status, BOOKING_STATUS.NO_SHOW_PENDING);
    assert.ok(marked.chargeableAt, "a charge time must be scheduled");
    assert.ok(
      marked.chargeableAt!.getTime() > Date.now(),
      "the charge must not be immediate",
    );

    // No money has moved yet.
    assert.equal(await db.charge.count({ where: { bookingId: booking.id } }), 0);
  });

  await step("the charge fires only once the window expires", async () => {
    const booking = await db.booking.findFirstOrThrow({
      where: { status: BOOKING_STATUS.NO_SHOW_PENDING },
    });

    // Nothing due yet.
    assert.equal((await collectDueCharges()).length, 0);

    // Expire the window.
    await db.booking.update({
      where: { id: booking.id },
      data: { chargeableAt: new Date(Date.now() - MIN) },
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
      method: CHECKIN_METHOD.QR,
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


  // --- venue QR check-in ----------------------------------------------------

  await step("a wrong venue key cannot check anyone in", async () => {
    const { booking } = await book(ctx, {
      phone: "+40700000010",
      name: "Guarded",
      startAt: new Date(Date.now() + 130 * HOUR),
    });
    await backdate(booking.id, new Date(Date.now() - 5 * MIN));

    const res = await checkInAtVenue({
      locationId: ctx.business.locations[0].id,
      key: "00000000000000ff",
      lookup: "+40700000010",
    });

    assert.equal(res.ok, false);
    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(after.status, BOOKING_STATUS.CONFIRMED, "must not be checked in");
    assert.equal(after.checkedInAt, null);
  });

  await step("the printed venue key checks a customer in", async () => {
    const location = ctx.business.locations[0];
    const { booking } = await book(ctx, {
      phone: "+40700000011",
      name: "Arrived",
      startAt: new Date(Date.now() + 150 * HOUR),
    });
    await backdate(booking.id, new Date(Date.now() - 5 * MIN));

    const res = await checkInAtVenue({
      locationId: location.id,
      key: venueKey(location.id, location.checkInSecret),
      lookup: "0700 000 011", // typed with spaces, no country code
    });

    assert.equal(res.ok, true);
    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(after.status, BOOKING_STATUS.CHECKED_IN);
    assert.ok(after.checkedInAt);
  });

  await step("scanning rescues someone already marked absent", async () => {
    const location = ctx.business.locations[0];
    const { booking } = await book(ctx, {
      phone: "+40700000012",
      name: "Late But Scanning",
      startAt: new Date(Date.now() + 170 * HOUR),
    });
    // 25 minutes late: past the 15 minute grace, inside the check-in window.
    await backdate(booking.id, new Date(Date.now() - 25 * MIN));
    await markNoShow({ bookingId: booking.id, actorLabel: "staff" });

    const res = await checkInAtVenue({
      locationId: location.id,
      key: venueKey(location.id, location.checkInSecret),
      lookup: "+40700000012",
    });

    assert.equal(res.ok, true);
    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(after.status, BOOKING_STATUS.CHECKED_IN);
    assert.equal(after.chargeableAt, null, "the pending charge must be cleared");

    await collectDueCharges();
    assert.equal(
      await db.charge.count({ where: { bookingId: booking.id } }),
      0,
      "a customer who scanned must never be charged",
    );
  });

  await step("check-in far outside the window is refused", async () => {
    const location = ctx.business.locations[0];
    await book(ctx, {
      phone: "+40700000013",
      name: "Way Too Early",
      startAt: new Date(Date.now() + 190 * HOUR), // days away
    });

    const res = await checkInAtVenue({
      locationId: location.id,
      key: venueKey(location.id, location.checkInSecret),
      lookup: "+40700000013",
    });
    assert.equal(res.ok, false);
  });

  await step("an unknown phone number finds nothing", async () => {
    const location = ctx.business.locations[0];
    const res = await checkInAtVenue({
      locationId: location.id,
      key: venueKey(location.id, location.checkInSecret),
      lookup: "+40799999999",
    });
    assert.equal(res.ok, false);
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
