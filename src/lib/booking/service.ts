import { customAlphabet, nanoid as secureId } from "nanoid";

import { db } from "@/lib/db";
import {
  ACTOR,
  BLOCKING_STATUSES,
  BOOKING_STATUS,
  CHARGE_STATUS,
  DISPUTE_STATUS,
  DISPUTE_WINDOW_DAYS,
  PAYOUT_STATUS,
  MANDATE_STATUS,
  REQUIREMENT,
  type Actor,
  type BookingStatus,
  type CheckInMethod,
} from "@/lib/constants";
import { mockProvider } from "@/lib/payments/mock";
import { nextRetryAt } from "@/lib/payments/provider";
import {
  assertActorMayResolveDispute,
  assertActorMayTransition,
  assertTransition,
  canMarkNoShow,
  cancellationOutcome,
} from "./state-machine";
import { overlaps } from "./availability";
import { resolvePolicyFor } from "./slots";

// No I/O/0/1 — these get read aloud over the phone.
const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

/** How long a mandate has to be completed before the slot is released. */
const SETUP_WINDOW_MS = 15 * 60 * 1000;
/** How long collected money is held before it reaches the business. */
const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

async function record(
  tx: Pick<typeof db, "bookingEvent">,
  params: {
    bookingId: string;
    from: BookingStatus | null;
    to: BookingStatus;
    actorType: Actor;
    actorLabel?: string;
    reason?: string;
  },
) {
  await tx.bookingEvent.create({
    data: {
      bookingId: params.bookingId,
      fromStatus: params.from,
      toStatus: params.to,
      actorType: params.actorType,
      actorLabel: params.actorLabel,
      reason: params.reason,
    },
  });
}

export interface CreateBookingInput {
  businessSlug: string;
  serviceId: string;
  resourceId: string;
  startAt: Date;
  partySize: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerNote?: string;
  /** Present only when the resolved policy asks for one. */
  cardToken?: string;
  policyTextShown: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a booking, holding the slot.
 *
 * Concurrency: the overlap re-check runs inside the transaction. On SQLite
 * that is sufficient, because writes are serialised at the database level. On
 * Postgres this MUST be replaced with an exclusion constraint over
 * (resourceId, tstzrange(startAt, endAt)) or a transaction-scoped advisory
 * lock per resource — a plain re-check races there.
 */
export async function createBooking(input: CreateBookingInput) {
  const business = await db.business.findUnique({
    where: { slug: input.businessSlug },
    include: { locations: { take: 1 } },
  });
  if (!business) throw new BookingError("Unknown business.", "no_business");
  if (business.suspendedAt) {
    throw new BookingError("This restaurant is not taking bookings right now.", "suspended");
  }

  const service = await db.service.findUnique({
    where: { id: input.serviceId },
  });
  if (!service || service.businessId !== business.id) {
    throw new BookingError("Unknown service.", "no_service");
  }

  const resource = await db.resource.findUnique({
    where: { id: input.resourceId },
  });
  if (!resource || resource.businessId !== business.id || !resource.active) {
    throw new BookingError("Unknown table.", "no_resource");
  }
  if (service.usesPartySize && resource.capacity < input.partySize) {
    throw new BookingError("That table is too small.", "capacity");
  }

  const startAt = input.startAt;
  const serviceEnd = new Date(
    startAt.getTime() + service.durationMin * 60_000,
  );
  const occupiedStart = new Date(
    startAt.getTime() - service.bufferBeforeMin * 60_000,
  );
  const occupiedEnd = new Date(
    serviceEnd.getTime() + service.bufferAfterMin * 60_000,
  );

  if (startAt.getTime() < Date.now()) {
    throw new BookingError("That time has passed.", "in_past");
  }

  // Resolve who this person is and what they must do, before we write.
  const policy = await resolvePolicyFor({
    businessId: business.id,
    serviceId: service.id,
    phone: input.customerPhone,
    partySize: input.partySize,
    startAt,
  });

  const needsCard = policy.requirement !== REQUIREMENT.NONE;
  if (needsCard && !input.cardToken) {
    throw new BookingError("A card is required for this booking.", "card_required");
  }

  // Save the card before opening the transaction — it is the slow, failable
  // step and we do not want it holding a write lock.
  let saved = null;
  if (needsCard) {
    try {
      saved = await mockProvider.saveCard({
        customerRef: null,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        cardToken: input.cardToken!,
      });
    } catch (err) {
      throw new BookingError(
        err instanceof Error ? err.message : "The card could not be saved.",
        "card_failed",
      );
    }
  }

  return db.$transaction(async (tx) => {
    // Re-check inside the transaction: the slot may have gone while the
    // customer was typing their card details.
    const clashes = await tx.booking.findMany({
      where: {
        resourceId: resource.id,
        status: { in: [...BLOCKING_STATUSES] },
        startAt: { lt: occupiedEnd },
        endAt: { gt: occupiedStart },
      },
      select: { id: true, startAt: true, endAt: true },
    });

    const reallyClashes = clashes.some((b) =>
      overlaps(occupiedStart, occupiedEnd, b.startAt, b.endAt),
    );
    if (reallyClashes) {
      throw new BookingError(
        "That table was just taken. Please pick another time.",
        "slot_taken",
      );
    }

    const customer = await tx.customer.upsert({
      where: { phone: input.customerPhone },
      create: {
        phone: input.customerPhone,
        name: input.customerName,
        email: input.customerEmail,
      },
      update: { name: input.customerName, email: input.customerEmail },
    });

    await tx.customerProfile.upsert({
      where: {
        businessId_customerId: {
          businessId: business.id,
          customerId: customer.id,
        },
      },
      create: { businessId: business.id, customerId: customer.id },
      update: {},
    });

    // The card (if any) was already saved above, so there is no pending_setup
    // step to wait through — the booking is live either way.
    const status = BOOKING_STATUS.CONFIRMED;

    const booking = await tx.booking.create({
      data: {
        reference: `TNT-${nanoid()}`,
        accessToken: secureId(24),
        businessId: business.id,
        serviceId: service.id,
        resourceId: resource.id,
        locationId: business.locations[0]?.id ?? null,
        customerId: customer.id,
        startAt,
        endAt: occupiedEnd,
        partySize: input.partySize,
        status,
        requirement: policy.requirement,
        feeCents: policy.feeCents,
        customerNote: input.customerNote,
        confirmedAt: new Date(),
        policySnapshot: {
          create: {
            policyText: input.policyTextShown,
            feeCents: policy.feeCents,
            currency: business.currency,
            cancellationWindowHours: business.cancellationWindowHours,
            gracePeriodMin: business.gracePeriodMin,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        },
      },
    });

    if (saved) {
      await tx.mandate.create({
        data: {
          bookingId: booking.id,
          customerId: customer.id,
          provider: mockProvider.name,
          providerCustomerRef: saved.providerCustomerRef,
          paymentMethodRef: saved.paymentMethodRef,
          setupIntentRef: saved.setupIntentRef,
          status: MANDATE_STATUS.ACTIVE,
          cardBrand: saved.cardBrand,
          cardLast4: saved.cardLast4,
          cardExpMonth: saved.cardExpMonth,
          cardExpYear: saved.cardExpYear,
          threeDSPassed: saved.threeDSPassed,
        },
      });
    }

    await record(tx, {
      bookingId: booking.id,
      from: null,
      to: status,
      actorType: ACTOR.CUSTOMER,
      reason: `policy: ${policy.matchedRuleName}`,
    });


    return { booking, policy, card: saved };
  });
}

/**
 * Record an arrival. The host confirms the customer by name; this is the only
 * thing that can pull a booking out of the charge path, and it works right up
 * until the charge fires (invariant 3). A staff override may only ever
 * prevent a charge, never cause one (invariant 2).
 */
export async function checkIn(params: {
  bookingId: string;
  method: CheckInMethod;
  actorLabel?: string;
}) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: params.bookingId },
    });
    if (!booking) throw new BookingError("Unknown booking.", "no_booking");

    const from = booking.status as BookingStatus;
    if (from === BOOKING_STATUS.CHECKED_IN) return booking; // idempotent

    assertTransition(from, BOOKING_STATUS.CHECKED_IN);

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BOOKING_STATUS.CHECKED_IN,
        checkedInAt: new Date(),
        // Arriving clears any pending charge, including one already scheduled.
        chargeableAt: null,
        noShowMarkedAt: null,
      },
    });

    await tx.checkIn.create({
      data: {
        bookingId: booking.id,
        method: params.method,
        actorLabel: params.actorLabel,
      },
    });

    await record(tx, {
      bookingId: booking.id,
      from,
      to: BOOKING_STATUS.CHECKED_IN,
      actorType: ACTOR.BUSINESS,
      actorLabel: params.actorLabel,
      reason: `check-in via ${params.method}`,
    });

    return updated;
  });
}

/**
 * Mark a customer absent. Starts a clock; it does not take money.
 * See invariant 1 in CLAUDE.md.
 */
export async function markNoShow(params: {
  bookingId: string;
  actorLabel: string;
}) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: params.bookingId },
      include: { business: true },
    });
    if (!booking) throw new BookingError("Unknown booking.", "no_booking");

    const from = booking.status as BookingStatus;

    const allowed = canMarkNoShow({
      status: from,
      startAt: booking.startAt,
      gracePeriodMin: booking.business.gracePeriodMin,
      checkedInAt: booking.checkedInAt,
    });
    if (!allowed.ok) throw new BookingError(allowed.reason, "grace_period");

    assertActorMayTransition(ACTOR.BUSINESS, BOOKING_STATUS.NO_SHOW_PENDING);
    assertTransition(from, BOOKING_STATUS.NO_SHOW_PENDING);

    const now = new Date();
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BOOKING_STATUS.NO_SHOW_PENDING,
        noShowMarkedAt: now,
        // Collectable at once: the grace period has already run out.
        chargeableAt: now,
      },
    });

    await record(tx, {
      bookingId: booking.id,
      from,
      to: BOOKING_STATUS.NO_SHOW_PENDING,
      actorType: ACTOR.BUSINESS,
      actorLabel: params.actorLabel,
      reason: "marked absent",
    });

    return updated;
  });
}

/**
 * Forgive a fee. Always allowed, always logged. If the money was already
 * taken — collected or under dispute — it is refunded, not just relabelled.
 */
export async function waive(params: { bookingId: string; actorLabel: string; reason?: string }) {
  const current = await db.booking.findUnique({ where: { id: params.bookingId } });
  if (
    current &&
    (current.status === BOOKING_STATUS.CHARGE_SUCCEEDED || current.status === BOOKING_STATUS.DISPUTED)
  ) {
    return refundBooking({
      bookingId: params.bookingId,
      actor: ACTOR.BUSINESS,
      actorLabel: params.actorLabel,
      note: params.reason ?? "refunded by the restaurant",
    });
  }

  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: params.bookingId } });
    if (!booking) throw new BookingError("Unknown booking.", "no_booking");

    const from = booking.status as BookingStatus;
    assertTransition(from, BOOKING_STATUS.WAIVED);

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: BOOKING_STATUS.WAIVED, chargeableAt: null },
    });

    await record(tx, {
      bookingId: booking.id,
      from,
      to: BOOKING_STATUS.WAIVED,
      actorType: ACTOR.BUSINESS,
      actorLabel: params.actorLabel,
      reason: params.reason ?? "waived",
    });

    return updated;
  });
}

export async function cancelBooking(params: {
  bookingId: string;
  actorType: Actor;
  actorLabel?: string;
}) {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: params.bookingId },
      include: { business: true },
    });
    if (!booking) throw new BookingError("Unknown booking.", "no_booking");

    const from = booking.status as BookingStatus;
    const to = cancellationOutcome(
      booking.startAt,
      booking.business.cancellationWindowHours,
      booking.requirement,
    );

    assertActorMayTransition(params.actorType, to);
    assertTransition(from, to);

    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: to,
        cancelledAt: new Date(),
        chargeableAt:
          to === BOOKING_STATUS.CANCELLED_LATE
            ? new Date()
            : null,
      },
    });

    await record(tx, {
      bookingId: booking.id,
      from,
      to,
      actorType: params.actorType,
      actorLabel: params.actorLabel,
    });

    return updated;
  });
}

/**
 * Record a no-show for every confirmed booking whose grace period has fully
 * elapsed with no check-in. The *system* does this, not staff, so it sits on
 * the right side of invariant 1: nobody asserted anything, a clock ran out.
 *
 * The grace period is the only hold the restaurant gives: once it ends the
 * table is released for other guests, and the fee is collectable. Staff can
 * still record a late arrival ("A venit totuși") or waive it until the charge
 * actually runs, and a collected fee can be disputed (see openDispute).
 *
 * The grace period is read from the policy snapshot when there is one: the
 * customer agreed to *that* number, and a restaurant shortening its grace
 * period later must not shorten it for bookings already made.
 *
 * Runs lazily (dashboard load, charge button) until a scheduled worker exists.
 */
export async function sweepNoShows(
  params: { businessId?: string; now?: Date } = {},
) {
  const now = params.now ?? new Date();

  const candidates = await db.booking.findMany({
    where: {
      ...(params.businessId ? { businessId: params.businessId } : {}),
      status: BOOKING_STATUS.CONFIRMED,
      checkedInAt: null,
      startAt: { lte: now },
    },
    include: { business: true, policySnapshot: true },
  });

  const marked: string[] = [];

  for (const booking of candidates) {
    const grace =
      booking.policySnapshot?.gracePeriodMin ?? booking.business.gracePeriodMin;
    const graceEnd = new Date(booking.startAt.getTime() + grace * 60_000);
    if (now < graceEnd) continue;

    assertActorMayTransition(ACTOR.SYSTEM, BOOKING_STATUS.NO_SHOW_PENDING);
    assertTransition(BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.NO_SHOW_PENDING);

    const done = await db.$transaction(async (tx) => {
      // Conditional on still being confirmed and not checked in: a check-in
      // that landed since the read above wins.
      const { count } = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: BOOKING_STATUS.CONFIRMED,
          checkedInAt: null,
        },
        data: {
          status: BOOKING_STATUS.NO_SHOW_PENDING,
          noShowMarkedAt: now,
          chargeableAt: graceEnd,
        },
      });
      if (count === 0) return false;

      await record(tx, {
        bookingId: booking.id,
        from: BOOKING_STATUS.CONFIRMED,
        to: BOOKING_STATUS.NO_SHOW_PENDING,
        actorType: ACTOR.SYSTEM,
        reason: `no check-in within ${grace} min grace period`,
      });
      return true;
    });

    if (done) marked.push(booking.reference);
  }

  return marked;
}

/**
 * The scheduled job: collect every no-show and late cancellation that is due,
 * plus soft declines whose retry is due. Idempotent — the unique key on Charge is
 * what makes a re-run safe.
 *
 * `businessId` scopes a run to one restaurant, which is what the dashboard's
 * button does; the future cron worker omits it.
 */
export async function collectDueCharges(
  now: Date = new Date(),
  scope: { businessId?: string } = {},
) {
  const due = await db.booking.findMany({
    where: {
      ...(scope.businessId ? { businessId: scope.businessId } : {}),
      // A suspended business collects nothing until the platform reinstates it.
      business: { suspendedAt: null },
      status: {
        in: [
          BOOKING_STATUS.NO_SHOW_PENDING,
          BOOKING_STATUS.CANCELLED_LATE,
          // A soft decline leaves chargeableAt at the next retry; a hard
          // decline or an exhausted ladder leaves it null, so neither is
          // picked up again.
          BOOKING_STATUS.CHARGE_FAILED,
        ],
      },
      chargeableAt: { lte: now },
      feeCents: { gt: 0 },
    },
    include: { mandate: true, business: true, customer: true },
  });

  const results: Array<{ reference: string; outcome: string }> = [];

  for (const booking of due) {
    const attempt = (await db.charge.count({ where: { bookingId: booking.id } })) + 1;
    const idempotencyKey = `noshow_${booking.id}_${attempt}`;

    if (!booking.mandate?.paymentMethodRef) {
      results.push({ reference: booking.reference, outcome: "no_mandate" });
      continue;
    }

    const result = await mockProvider.chargeOffSession({
      paymentMethodRef: booking.mandate.paymentMethodRef,
      providerCustomerRef: booking.mandate.providerCustomerRef ?? "",
      amountCents: booking.feeCents,
      currency: booking.business.currency,
      idempotencyKey,
      description: `No-show ${booking.reference} — ${booking.business.name}`,
      destinationAccountRef: booking.business.stripeAccountId,
    });

    const from = booking.status as BookingStatus;

    if (result.ok) {
      await db.$transaction(async (tx) => {
        await tx.charge.create({
          data: {
            bookingId: booking.id,
            amountCents: booking.feeCents,
            currency: booking.business.currency,
            status: CHARGE_STATUS.SUCCEEDED,
            idempotencyKey,
            provider: mockProvider.name,
            providerRef: result.providerRef,
            attempt,
            succeededAt: new Date(),
            // Held, not paid out: the customer has DISPUTE_WINDOW_DAYS to
            // contest it before it reaches the business.
            payoutStatus: PAYOUT_STATUS.HELD,
            payoutReleaseAt: new Date(now.getTime() + DISPUTE_WINDOW_MS),
          },
        });
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BOOKING_STATUS.CHARGE_SUCCEEDED, chargeableAt: null },
        });
        await record(tx, {
          bookingId: booking.id,
          from,
          to: BOOKING_STATUS.CHARGE_SUCCEEDED,
          actorType: ACTOR.SYSTEM,
          reason: `charged ${booking.feeCents}`,
        });
      });
      results.push({ reference: booking.reference, outcome: "charged" });
      continue;
    }

    const retryAt = result.retryable ? nextRetryAt(attempt, now) : null;

    await db.$transaction(async (tx) => {
      await tx.charge.create({
        data: {
          bookingId: booking.id,
          amountCents: booking.feeCents,
          currency: booking.business.currency,
          status: retryAt ? CHARGE_STATUS.FAILED : CHARGE_STATUS.UNCOLLECTIBLE,
          idempotencyKey,
          provider: mockProvider.name,
          attempt,
          lastError: `${result.code}: ${result.message}`,
          nextRetryAt: retryAt,
        },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BOOKING_STATUS.CHARGE_FAILED,
          chargeableAt: retryAt,
        },
      });
      await record(tx, {
        bookingId: booking.id,
        from,
        to: BOOKING_STATUS.CHARGE_FAILED,
        actorType: ACTOR.SYSTEM,
        reason: result.code,
      });
    });

    results.push({
      reference: booking.reference,
      outcome: retryAt ? `failed, retry ${retryAt.toISOString()}` : "uncollectible",
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Refunds, disputes, payouts
// ---------------------------------------------------------------------------

/**
 * Give a collected fee back in full. The provider refund runs first, with an
 * idempotency key per charge, so a retry after a crash cannot pay out twice;
 * the database then records the booking as waived.
 */
export async function refundBooking(params: {
  bookingId: string;
  actor: Actor;
  actorLabel?: string;
  note?: string;
}) {
  const booking = await db.booking.findUnique({
    where: { id: params.bookingId },
    include: { charges: true, dispute: true },
  });
  if (!booking) throw new BookingError("Unknown booking.", "no_booking");

  const from = booking.status as BookingStatus;
  assertTransition(from, BOOKING_STATUS.WAIVED);
  if (from === BOOKING_STATUS.DISPUTED) assertActorMayResolveDispute(params.actor, "refund");

  const charge = booking.charges.find((c) => c.status === CHARGE_STATUS.SUCCEEDED);
  if (!charge?.providerRef) throw new BookingError("There is no collected fee to refund.", "no_charge");

  const result = await mockProvider.refund({
    chargeRef: charge.providerRef,
    amountCents: charge.amountCents,
    idempotencyKey: `refund_${charge.id}`,
  });
  if (!result.ok) throw new BookingError(`Refund failed: ${result.message}`, "refund_failed");

  return db.$transaction(async (tx) => {
    const now = new Date();
    await tx.charge.update({
      where: { id: charge.id },
      data: {
        status: CHARGE_STATUS.REFUNDED,
        payoutStatus: PAYOUT_STATUS.REFUNDED,
        refundedAt: now,
        refundRef: result.refundRef,
      },
    });
    if (booking.dispute && booking.dispute.status === DISPUTE_STATUS.OPEN) {
      await tx.dispute.update({
        where: { id: booking.dispute.id },
        data: {
          status: DISPUTE_STATUS.REFUNDED,
          resolvedAt: now,
          resolvedBy: params.actor,
          resolution: params.note,
        },
      });
    }
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: BOOKING_STATUS.WAIVED, chargeableAt: null },
    });
    await record(tx, {
      bookingId: booking.id,
      from,
      to: BOOKING_STATUS.WAIVED,
      actorType: params.actor,
      actorLabel: params.actorLabel,
      reason: `refunded ${charge.amountCents}${params.note ? ` — ${params.note}` : ""}`,
    });
    return updated;
  });
}

/**
 * The customer contests a collected fee, from their own booking page. Allowed
 * while the money is still held; it freezes the payout until the dispute is
 * resolved. Only the customer can open one (see assertActorMayTransition).
 */
export async function openDispute(params: { accessToken: string; reason?: string; now?: Date }) {
  const now = params.now ?? new Date();
  const booking = await db.booking.findUnique({
    where: { accessToken: params.accessToken },
    include: { charges: true, dispute: true },
  });
  if (!booking) throw new BookingError("Unknown booking.", "no_booking");
  if (booking.dispute) return booking.dispute; // already open or settled — idempotent

  const from = booking.status as BookingStatus;
  if (from !== BOOKING_STATUS.CHARGE_SUCCEEDED) {
    throw new BookingError("There is no collected fee to dispute.", "not_charged");
  }
  const charge = booking.charges.find((c) => c.status === CHARGE_STATUS.SUCCEEDED);
  if (!charge || charge.payoutStatus !== PAYOUT_STATUS.HELD || !charge.payoutReleaseAt || now > charge.payoutReleaseAt) {
    throw new BookingError(
      `Disputes can be opened within ${DISPUTE_WINDOW_DAYS} days of the charge.`,
      "dispute_window_closed",
    );
  }

  assertActorMayTransition(ACTOR.CUSTOMER, BOOKING_STATUS.DISPUTED);
  assertTransition(from, BOOKING_STATUS.DISPUTED);

  const reason = params.reason?.trim().slice(0, 1000) || null;

  return db.$transaction(async (tx) => {
    const dispute = await tx.dispute.create({ data: { bookingId: booking.id, reason } });
    await tx.charge.update({ where: { id: charge.id }, data: { payoutStatus: PAYOUT_STATUS.FROZEN } });
    await tx.booking.update({ where: { id: booking.id }, data: { status: BOOKING_STATUS.DISPUTED } });
    await record(tx, {
      bookingId: booking.id,
      from,
      to: BOOKING_STATUS.DISPUTED,
      actorType: ACTOR.CUSTOMER,
      reason: reason ? `disputed: ${reason}` : "disputed",
    });
    return dispute;
  });
}

/**
 * Settle an open dispute. Refund is open to the business and the platform;
 * upholding is the platform's alone, and releases the money at once.
 */
export async function resolveDispute(params: {
  bookingId: string;
  outcome: "refund" | "uphold";
  actor: Actor;
  actorLabel?: string;
  note?: string;
}) {
  assertActorMayResolveDispute(params.actor, params.outcome);

  if (params.outcome === "refund") {
    return refundBooking({
      bookingId: params.bookingId,
      actor: params.actor,
      actorLabel: params.actorLabel,
      note: params.note,
    });
  }

  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: params.bookingId },
      include: { charges: true, dispute: true },
    });
    if (!booking?.dispute) throw new BookingError("No dispute on this booking.", "no_dispute");
    if (booking.dispute.status !== DISPUTE_STATUS.OPEN) {
      throw new BookingError("This dispute is already resolved.", "dispute_resolved");
    }

    const from = booking.status as BookingStatus;
    assertTransition(from, BOOKING_STATUS.CHARGE_SUCCEEDED);

    const now = new Date();
    const charge = booking.charges.find((c) => c.status === CHARGE_STATUS.SUCCEEDED);
    if (charge) {
      await tx.charge.update({
        where: { id: charge.id },
        data: { payoutStatus: PAYOUT_STATUS.RELEASED, payoutReleaseAt: now },
      });
    }
    await tx.dispute.update({
      where: { id: booking.dispute.id },
      data: { status: DISPUTE_STATUS.UPHELD, resolvedAt: now, resolvedBy: params.actor, resolution: params.note },
    });
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: BOOKING_STATUS.CHARGE_SUCCEEDED },
    });
    await record(tx, {
      bookingId: booking.id,
      from,
      to: BOOKING_STATUS.CHARGE_SUCCEEDED,
      actorType: params.actor,
      actorLabel: params.actorLabel,
      reason: `dispute upheld${params.note ? ` — ${params.note}` : ""}`,
    });
    return updated;
  });
}

/**
 * Pay out every held fee whose dispute window has passed without a dispute.
 * Frozen (disputed) money is untouched. Runs lazily, like the no-show sweep.
 */
export async function releaseDuePayouts(params: { businessId?: string; now?: Date } = {}) {
  const now = params.now ?? new Date();
  const { count } = await db.charge.updateMany({
    where: {
      status: CHARGE_STATUS.SUCCEEDED,
      payoutStatus: PAYOUT_STATUS.HELD,
      payoutReleaseAt: { lte: now },
      ...(params.businessId ? { booking: { businessId: params.businessId } } : {}),
    },
    data: { payoutStatus: PAYOUT_STATUS.RELEASED },
  });
  return count;
}

/** Platform action. A suspended business takes no bookings and collects nothing. */
export async function setSuspended(params: { businessId: string; suspended: boolean }) {
  return db.business.update({
    where: { id: params.businessId },
    data: {
      suspendedAt: params.suspended ? new Date() : null,
      // Out of search while suspended; the owner republishes afterwards.
      ...(params.suspended ? { published: false } : {}),
    },
  });
}

export { SETUP_WINDOW_MS, DISPUTE_WINDOW_MS };
