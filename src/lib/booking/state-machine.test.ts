import { test } from "node:test";
import assert from "node:assert/strict";

import { ACTOR, BOOKING_STATUS, REQUIREMENT } from "@/lib/constants";
import {
  ForbiddenActorError,
  InvalidTransitionError,
  assertActorMayResolveDispute,
  assertActorMayTransition,
  assertTransition,
  canMarkNoShow,
  canTransition,
  cancellationOutcome,
  isTerminal,
} from "./state-machine";

const MIN = 60_000;
const HOUR = 3_600_000;

test("a confirmed booking can be checked in, cancelled, or marked absent", () => {
  assert.ok(canTransition(BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN));
  assert.ok(canTransition(BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED_FREE));
  assert.ok(canTransition(BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.NO_SHOW_PENDING));
});

test("a booking cannot jump straight from confirmed to charged", () => {
  assert.throws(
    () => assertTransition(BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHARGE_SUCCEEDED),
    InvalidTransitionError,
  );
});

test("the late arrival can still rescue themselves during the grace window", () => {
  // 20:25 for a 20:00 booking: already marked absent, walks in, checks in.
  assert.ok(
    canTransition(BOOKING_STATUS.NO_SHOW_PENDING, BOOKING_STATUS.CHECKED_IN),
    "checking in must pull a booking back out of the charge path",
  );
});

test("a customer may never move their own booking into a charging state", () => {
  assert.throws(
    () => assertActorMayTransition(ACTOR.CUSTOMER, BOOKING_STATUS.NO_SHOW_PENDING),
    ForbiddenActorError,
  );
  assert.throws(
    () => assertActorMayTransition(ACTOR.CUSTOMER, BOOKING_STATUS.CANCELLED_LATE),
    ForbiddenActorError,
  );
});

test("a business cannot assert that a charge succeeded", () => {
  assert.throws(
    () => assertActorMayTransition(ACTOR.BUSINESS, BOOKING_STATUS.CHARGE_SUCCEEDED),
    ForbiddenActorError,
  );
  // But the system, acting on the provider's result, may.
  assert.doesNotThrow(() =>
    assertActorMayTransition(ACTOR.SYSTEM, BOOKING_STATUS.CHARGE_SUCCEEDED),
  );
});

test("a business may mark a no-show, and may always waive", () => {
  assert.doesNotThrow(() =>
    assertActorMayTransition(ACTOR.BUSINESS, BOOKING_STATUS.NO_SHOW_PENDING),
  );
  assert.doesNotThrow(() =>
    assertActorMayTransition(ACTOR.BUSINESS, BOOKING_STATUS.WAIVED),
  );
});

test("no-show cannot be marked before the grace period elapses", () => {
  const startAt = new Date("2026-10-01T18:00:00Z");
  const base = {
    status: BOOKING_STATUS.CONFIRMED,
    startAt,
    gracePeriodMin: 15,
    checkedInAt: null,
  };

  // 18:10 — still inside the 15 minute hold.
  const early = canMarkNoShow(base, new Date(startAt.getTime() + 10 * MIN));
  assert.equal(early.ok, false);
  assert.match((early as { reason: string }).reason, /5 min left/);

  // 18:16 — the hold has expired.
  const late = canMarkNoShow(base, new Date(startAt.getTime() + 16 * MIN));
  assert.equal(late.ok, true);
});

test("a checked-in customer can never be marked absent", () => {
  const startAt = new Date("2026-10-01T18:00:00Z");
  const result = canMarkNoShow(
    {
      status: BOOKING_STATUS.CONFIRMED,
      startAt,
      gracePeriodMin: 15,
      checkedInAt: new Date(startAt.getTime() + 2 * MIN),
    },
    new Date(startAt.getTime() + 90 * MIN),
  );
  assert.equal(result.ok, false);
  assert.match((result as { reason: string }).reason, /already checked in/);
});

test("cancelling inside the window is free, outside it is chargeable", () => {
  const startAt = new Date("2026-10-01T18:00:00Z");

  // 48h before, window is 24h -> free.
  assert.equal(
    cancellationOutcome(startAt, 24, REQUIREMENT.CARD_ON_FILE, new Date(startAt.getTime() - 48 * HOUR)),
    BOOKING_STATUS.CANCELLED_FREE,
  );

  // 2h before -> late.
  assert.equal(
    cancellationOutcome(startAt, 24, REQUIREMENT.CARD_ON_FILE, new Date(startAt.getTime() - 2 * HOUR)),
    BOOKING_STATUS.CANCELLED_LATE,
  );
});

test("a trusted regular is never charged for cancelling late", () => {
  const startAt = new Date("2026-10-01T18:00:00Z");
  assert.equal(
    cancellationOutcome(startAt, 24, REQUIREMENT.NONE, new Date(startAt.getTime() - 10 * MIN)),
    BOOKING_STATUS.CANCELLED_FREE,
  );
});

test("terminal states really are terminal", () => {
  assert.ok(isTerminal(BOOKING_STATUS.COMPLETED));
  assert.ok(isTerminal(BOOKING_STATUS.WAIVED));
  assert.ok(isTerminal(BOOKING_STATUS.CANCELLED_FREE));
  assert.ok(!isTerminal(BOOKING_STATUS.CONFIRMED));
});

test("only the customer can open a dispute", () => {
  assert.doesNotThrow(() => assertActorMayTransition(ACTOR.CUSTOMER, BOOKING_STATUS.DISPUTED));
  for (const actor of [ACTOR.BUSINESS, ACTOR.SYSTEM, ACTOR.PLATFORM]) {
    assert.throws(() => assertActorMayTransition(actor, BOOKING_STATUS.DISPUTED), ForbiddenActorError);
  }
});

test("a business can refund a dispute but never uphold one", () => {
  assert.doesNotThrow(() => assertActorMayResolveDispute(ACTOR.BUSINESS, "refund"));
  assert.throws(() => assertActorMayResolveDispute(ACTOR.BUSINESS, "uphold"), ForbiddenActorError);
  assert.doesNotThrow(() => assertActorMayResolveDispute(ACTOR.PLATFORM, "uphold"));
  assert.throws(() => assertActorMayResolveDispute(ACTOR.CUSTOMER, "uphold"), ForbiddenActorError);
});

test("a failed charge took nothing, so it cannot be disputed", () => {
  assert.equal(canTransition(BOOKING_STATUS.CHARGE_FAILED, BOOKING_STATUS.DISPUTED), false);
  assert.equal(canTransition(BOOKING_STATUS.CHARGE_SUCCEEDED, BOOKING_STATUS.DISPUTED), true);
});
