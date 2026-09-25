import { TZDate } from "@date-fns/tz";

import { db } from "@/lib/db";
import { BLOCKING_STATUSES } from "@/lib/constants";
import { type Slot, generateSlots } from "./availability";
import {
  type PolicyContext,
  type PolicyOutcome,
  resolveRequirement,
} from "./policy";

/**
 * Database-facing layer over the pure availability engine. Loads the rows the
 * engine needs, nothing more.
 */

export async function getBookingPageData(slug: string) {
  return db.business.findUnique({
    where: { slug },
    include: {
      locations: true,
      services: { where: { active: true }, orderBy: { name: "asc" } },
      resources: { where: { active: true }, orderBy: { capacity: "asc" } },
      scheduleRules: true,
    },
  });
}

export interface SlotQuery {
  businessId: string;
  serviceId: string;
  partySize: number;
  from: Date;
  to: Date;
  slotIntervalMin?: number;
}

export async function findSlots(query: SlotQuery): Promise<Slot[]> {
  const business = await db.business.findUnique({
    where: { id: query.businessId },
    include: {
      resources: { where: { active: true } },
      scheduleRules: true,
    },
  });
  if (!business) return [];

  const service = await db.service.findUnique({
    where: { id: query.serviceId },
  });
  if (!service || service.businessId !== business.id) return [];

  // Widen the window by a day either side: a booking that starts before `from`
  // can still occupy a slot inside it, and buffers spill past `to`.
  const pad = 24 * 60 * 60 * 1000;

  const [bookings, timeOff] = await Promise.all([
    db.booking.findMany({
      where: {
        businessId: business.id,
        status: { in: [...BLOCKING_STATUSES] },
        startAt: { lt: new Date(query.to.getTime() + pad) },
        endAt: { gt: new Date(query.from.getTime() - pad) },
      },
      select: { resourceId: true, startAt: true, endAt: true },
    }),
    db.timeOff.findMany({
      where: {
        businessId: business.id,
        startAt: { lt: new Date(query.to.getTime() + pad) },
        endAt: { gt: new Date(query.from.getTime() - pad) },
      },
      select: { resourceId: true, startAt: true, endAt: true },
    }),
  ]);

  return generateSlots({
    timezone: business.timezone,
    service: {
      durationMin: service.durationMin,
      bufferBeforeMin: service.bufferBeforeMin,
      bufferAfterMin: service.bufferAfterMin,
      usesPartySize: service.usesPartySize,
    },
    resources: business.resources.map((r) => ({
      id: r.id,
      capacity: r.capacity,
    })),
    scheduleRules: business.scheduleRules.map((r) => ({
      resourceId: r.resourceId,
      weekday: r.weekday,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
    })),
    timeOff,
    bookings,
    partySize: query.partySize,
    slotIntervalMin: query.slotIntervalMin ?? 30,
    from: query.from,
    to: query.to,
  });
}

/**
 * What this specific person must do to hold this specific slot. Called before
 * the card step so the booking page can skip it entirely for a regular.
 */
export async function resolvePolicyFor(params: {
  businessId: string;
  serviceId: string;
  phone: string | null;
  partySize: number;
  startAt: Date;
}): Promise<PolicyOutcome> {
  const [business, service, rules] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: params.businessId } }),
    db.service.findUniqueOrThrow({ where: { id: params.serviceId } }),
    db.policyRule.findMany({
      where: { businessId: params.businessId, enabled: true },
      orderBy: { priority: "asc" },
    }),
  ]);

  let completedHere = 0;
  let hasNoShowHistory = false;

  if (params.phone) {
    const customer = await db.customer.findUnique({
      where: { phone: params.phone },
      include: {
        profiles: { where: { businessId: params.businessId }, take: 1 },
      },
    });
    if (customer) {
      const profile = customer.profiles[0];
      // A business can vouch for someone manually; treat that as enough
      // history to clear the "regulars book free" rule.
      completedHere = profile?.trusted
        ? Number.MAX_SAFE_INTEGER
        : (profile?.completedCount ?? 0);
      hasNoShowHistory = customer.noShowCount > 0;
    }
  }

  const ctx: PolicyContext = {
    completedHere,
    hasNoShowHistory,
    partySize: params.partySize,
    servicePriceCents: service.priceCents,
    weekday: new TZDate(params.startAt.getTime(), business.timezone).getDay(),
  };

  return resolveRequirement(rules, ctx, {
    noShowFeeCents: service.noShowFeeCents ?? business.noShowFeeCents,
  });
}
