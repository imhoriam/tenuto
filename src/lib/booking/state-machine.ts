import { ACTOR, BOOKING_STATUS, type Actor, type BookingStatus } from "@/lib/constants";

/**
 * The booking lifecycle, as an explicit transition table.
 *
 * Two invariants this file exists to protect:
 *
 *  1. A business can never *cause* a charge by assertion alone. Marking a
 *     no-show only moves the booking to NO_SHOW_PENDING, and a customer
 *     check-in — at any point before the charge fires — pulls it back out.
 *  2. A manual staff override may only ever prevent a charge, never create
 *     one. Enforced in `assertActorMayTransition`.
 */

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  [BOOKING_STATUS.DRAFT]: [
    BOOKING_STATUS.PENDING_SETUP,
    // A trusted regular needs no card, so the booking confirms immediately.
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.EXPIRED,
  ],
  [BOOKING_STATUS.PENDING_SETUP]: [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.EXPIRED,
  ],
  [BOOKING_STATUS.CONFIRMED]: [
    BOOKING_STATUS.CHECKED_IN,
    BOOKING_STATUS.CANCELLED_FREE,
    BOOKING_STATUS.CANCELLED_LATE,
    BOOKING_STATUS.NO_SHOW_PENDING,
  ],
  [BOOKING_STATUS.CHECKED_IN]: [BOOKING_STATUS.COMPLETED],
  [BOOKING_STATUS.NO_SHOW_PENDING]: [
    // The late arrival. They turn up at 20:25 for 20:00 while the grace
    // window is still running — checking in must still rescue them.
    BOOKING_STATUS.CHECKED_IN,
    BOOKING_STATUS.CHARGE_SUCCEEDED,
    BOOKING_STATUS.CHARGE_FAILED,
    BOOKING_STATUS.WAIVED,
  ],
  [BOOKING_STATUS.CANCELLED_LATE]: [
    BOOKING_STATUS.CHARGE_SUCCEEDED,
    BOOKING_STATUS.CHARGE_FAILED,
    BOOKING_STATUS.WAIVED,
  ],
  [BOOKING_STATUS.CHARGE_FAILED]: [
    // Retry ladder: +24h, +72h, then give up.
    BOOKING_STATUS.CHARGE_SUCCEEDED,
    BOOKING_STATUS.WAIVED,
    BOOKING_STATUS.DISPUTED,
  ],
  [BOOKING_STATUS.CHARGE_SUCCEEDED]: [
    BOOKING_STATUS.DISPUTED,
    BOOKING_STATUS.WAIVED, // refunded after the fact
  ],
  [BOOKING_STATUS.DISPUTED]: [
    BOOKING_STATUS.WAIVED,
    BOOKING_STATUS.CHARGE_SUCCEEDED,
  ],
  // Terminal.
  [BOOKING_STATUS.COMPLETED]: [],
  [BOOKING_STATUS.CANCELLED_FREE]: [],
  [BOOKING_STATUS.WAIVED]: [],
  [BOOKING_STATUS.EXPIRED]: [],
};

/** Transitions that result in the customer being charged. */
const CHARGING_TRANSITIONS: readonly BookingStatus[] = [
  BOOKING_STATUS.NO_SHOW_PENDING,
  BOOKING_STATUS.CANCELLED_LATE,
  BOOKING_STATUS.CHARGE_SUCCEEDED,
];

export class InvalidTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Invalid booking transition: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class ForbiddenActorError extends Error {
  constructor(actor: Actor, to: BookingStatus) {
    super(`Actor "${actor}" may not move a booking to "${to}"`);
    this.name = "ForbiddenActorError";
  }
}

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: BookingStatus,
  to: BookingStatus,
): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/**
 * Invariant 2. Only the system may actually move money — a business marks a
 * no-show (which merely starts the clock) and the scheduled job does the rest.
 * A customer may never move their own booking into a charging state.
 */
export function assertActorMayTransition(
  actor: Actor,
  to: BookingStatus,
): void {
  if (actor === ACTOR.CUSTOMER && CHARGING_TRANSITIONS.includes(to)) {
    throw new ForbiddenActorError(actor, to);
  }
  if (actor === ACTOR.BUSINESS && to === BOOKING_STATUS.CHARGE_SUCCEEDED) {
    // A business asserting "they were charged" is not a thing. Only the
    // payment provider's result may produce this.
    throw new ForbiddenActorError(actor, to);
  }
}

/**
 * A booking may only be marked absent once the grace window has fully elapsed.
 * This is the "restaurants hold the table 15-20 minutes" rule, turned from an
 * informal habit into something the customer can rely on and the business
 * cannot short-circuit.
 */
export function noShowMarkableAt(
  startAt: Date,
  gracePeriodMin: number,
): Date {
  return new Date(startAt.getTime() + gracePeriodMin * 60_000);
}

export function canMarkNoShow(
  params: {
    status: BookingStatus;
    startAt: Date;
    gracePeriodMin: number;
    checkedInAt: Date | null;
  },
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (params.checkedInAt) {
    return { ok: false, reason: "Customer already checked in." };
  }
  if (params.status !== BOOKING_STATUS.CONFIRMED) {
    return { ok: false, reason: `Booking is ${params.status}, not confirmed.` };
  }
  const markableAt = noShowMarkableAt(params.startAt, params.gracePeriodMin);
  if (now < markableAt) {
    const mins = Math.ceil((markableAt.getTime() - now.getTime()) / 60_000);
    return {
      ok: false,
      reason: `Grace period still running — ${mins} min left.`,
    };
  }
  return { ok: true };
}

/**
 * Cancelling inside the window is free; outside it is chargeable. Returns the
 * status the cancellation should land in.
 */
export function cancellationOutcome(
  startAt: Date,
  cancellationWindowHours: number,
  requirement: string,
  now: Date = new Date(),
): BookingStatus {
  // Nothing was ever collectable from a trusted regular.
  if (requirement === "none") return BOOKING_STATUS.CANCELLED_FREE;

  const deadline = new Date(
    startAt.getTime() - cancellationWindowHours * 3_600_000,
  );
  return now <= deadline
    ? BOOKING_STATUS.CANCELLED_FREE
    : BOOKING_STATUS.CANCELLED_LATE;
}

export function isTerminal(status: BookingStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Exposed for tests and for rendering the lifecycle in the dashboard. */
export const TRANSITION_TABLE = TRANSITIONS;
