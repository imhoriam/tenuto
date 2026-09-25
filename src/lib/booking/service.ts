import { customAlphabet } from "nanoid";

import { db } from "@/lib/db";
import {
  ACTOR,
  BLOCKING_STATUSES,
  BOOKING_STATUS,
  CHANNEL,
  CHARGE_STATUS,
  CHECKIN_METHOD,
  MANDATE_STATUS,
  REQUIREMENT,
  type Actor,
  type BookingStatus,
  type CheckInMethod,
} from "@/lib/constants";
import { mockProvider } from "@/lib/payments/mock";
import { nextRetryAt } from "@/lib/payments/provider";
import {
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
/** Breathing room between marking someone absent and taking their money. */
const CHARGE_GRACE_MS = 2 * 60 * 60 * 1000;

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

    await tx.notification.create({
      data: {
        bookingId: booking.id,
        channel: CHANNEL.CONSOLE,
        template: "confirmation",
        body: `${booking.reference}: masă pentru ${input.partySize} la ${business.name}.`,
        status: "sent",
        sentAt: new Date(),
      },
    });

    return { booking, policy, card: saved };
  });
}

/**
 * Customer check-in. The only thing that can pull a booking out of the charge
 * path — see invariant 3 in CLAUDE.md.
 */
export async function checkIn(params: {
  bookingId: string;
  method: CheckInMethod;
  lat?: number;
  lng?: number;
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

    const actor =
      params.method === CHECKIN_METHOD.MANUAL ? ACTOR.BUSINESS : ACTOR.CUSTOMER;

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
        lat: params.lat,
        lng: params.lng,
        actorLabel: params.actorLabel,
      },
    });

    await record(tx, {
      bookingId: booking.id,
      from,
      to: BOOKING_STATUS.CHECKED_IN,
      actorType: actor,
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
        chargeableAt: new Date(now.getTime() + CHARGE_GRACE_MS),
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

/** Forgive a charge. Always allowed, always logged. */
export async function waive(params: { bookingId: string; actorLabel: string; reason?: string }) {
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
            ? new Date(Date.now() + CHARGE_GRACE_MS)
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
 * The scheduled job: collect everything whose grace window has expired.
 * Idempotent — the unique key on Charge is what makes a re-run safe.
 */
export async function collectDueCharges(now: Date = new Date()) {
  const due = await db.booking.findMany({
    where: {
      status: {
        in: [BOOKING_STATUS.NO_SHOW_PENDING, BOOKING_STATUS.CANCELLED_LATE],
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

export { SETUP_WINDOW_MS, CHARGE_GRACE_MS };
