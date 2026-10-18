"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/lib/db";
import { REQUIREMENT } from "@/lib/constants";
import { pickResource } from "@/lib/booking/availability";
import { BookingError, createBooking } from "@/lib/booking/service";
import { findSlots, resolvePolicyFor } from "@/lib/booking/slots";
import { sendBookingConfirmation } from "@/lib/notifications/deliver";
import { publicBaseUrl } from "@/lib/origin";

/** Local YYYY-MM-DD -> the instant window covering that day in `timezone`. */
function dayWindow(isoDate: string, timezone: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Probe noon to read the offset, then bracket the local day generously;
  // generateSlots clips to the window.
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  const offsetMin = offsetMinutes(probe, timezone);
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0) - offsetMin * 60_000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60_000 - 1);
  return { from: startUtc, to: endUtc };
}

function offsetMinutes(at: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return (asUtc - at.getTime()) / 60_000;
}

const slotsSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().min(1).max(20),
});

export type SlotOption = {
  iso: string;
  label: string;
  resourceId: string;
};

export async function getSlots(input: z.input<typeof slotsSchema>) {
  const parsed = slotsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Date invalide." };

  const business = await db.business.findUnique({
    where: { slug: parsed.data.slug },
    include: { resources: { where: { active: true } }, services: true },
  });
  if (!business) return { ok: false as const, error: "Restaurant inexistent." };

  const service = business.services.find((s) => s.id === parsed.data.serviceId);
  if (!service) return { ok: false as const, error: "Serviciu inexistent." };

  const { from, to } = dayWindow(parsed.data.date, business.timezone);

  const slots = await findSlots({
    businessId: business.id,
    serviceId: service.id,
    partySize: parsed.data.partySize,
    from,
    to,
  });

  const fmt = new Intl.DateTimeFormat("ro-RO", {
    timeZone: business.timezone,
    hour: "2-digit",
    minute: "2-digit",
  });

  const options: SlotOption[] = slots.flatMap((slot) => {
    const resourceId = pickResource(
      slot,
      business.resources.map((r) => ({ id: r.id, capacity: r.capacity })),
      parsed.data.partySize,
      service.usesPartySize,
    );
    if (!resourceId) return [];
    return [
      {
        iso: slot.startAt.toISOString(),
        label: fmt.format(slot.startAt),
        resourceId,
      },
    ];
  });

  return { ok: true as const, slots: options };
}

const policySchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  phone: z.string().min(6),
  partySize: z.coerce.number().int().min(1).max(20),
  startAt: z.string().min(1),
});

/**
 * Resolve what this person must do *before* showing them a card form, so a
 * regular never sees one.
 */
export async function getPolicy(input: z.input<typeof policySchema>) {
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Date invalide." };

  const business = await db.business.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (!business) return { ok: false as const, error: "Restaurant inexistent." };

  const outcome = await resolvePolicyFor({
    businessId: business.id,
    serviceId: parsed.data.serviceId,
    phone: parsed.data.phone,
    partySize: parsed.data.partySize,
    startAt: new Date(parsed.data.startAt),
  });

  const fee = new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: business.currency,
    maximumFractionDigits: 0,
  }).format(outcome.feeCents / 100);

  const policyText =
    outcome.requirement === REQUIREMENT.NONE
      ? `Sunteți client cunoscut — nu cerem card. Masa este ținută ${business.gracePeriodMin} de minute după ora rezervării.`
      : `Nu se reține nimic acum. Dacă nu ajungeți, sau anulați cu mai puțin de ${business.cancellationWindowHours} h înainte, veți fi taxat cu ${fee}. Masa este ținută ${business.gracePeriodMin} de minute după ora rezervării.`;

  return {
    ok: true as const,
    requirement: outcome.requirement,
    feeCents: outcome.feeCents,
    feeLabel: fee,
    ruleName: outcome.matchedRuleName,
    policyText,
    gracePeriodMin: business.gracePeriodMin,
  };
}

const createSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  resourceId: z.string().min(1),
  startAt: z.string().min(1),
  partySize: z.coerce.number().int().min(1).max(20),
  name: z.string().min(2, "Numele este prea scurt."),
  phone: z.string().min(6, "Număr de telefon invalid."),
  email: z.string().email().optional().or(z.literal("")),
  note: z.string().max(280).optional(),
  cardToken: z.string().optional(),
  policyText: z.string().min(1),
  accepted: z.literal(true, { message: "Trebuie să acceptați condițiile." }),
});

export async function submitBooking(input: z.input<typeof createSchema>) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Date invalide.",
    };
  }

  const head = await headers();

  try {
    const { booking, policy, card } = await createBooking({
      businessSlug: parsed.data.slug,
      serviceId: parsed.data.serviceId,
      resourceId: parsed.data.resourceId,
      startAt: new Date(parsed.data.startAt),
      partySize: parsed.data.partySize,
      customerName: parsed.data.name,
      customerPhone: parsed.data.phone,
      customerEmail: parsed.data.email || undefined,
      customerNote: parsed.data.note || undefined,
      cardToken: parsed.data.cardToken,
      policyTextShown: parsed.data.policyText,
      // x-forwarded-for is spoofable; it is corroborating evidence in a
      // dispute, never proof on its own.
      ipAddress: head.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: head.get("user-agent") ?? undefined,
    });

    const baseUrl = await publicBaseUrl();
    const sms = await sendBookingConfirmation({ bookingId: booking.id, baseUrl });

    return {
      ok: true as const,
      smsSent: sms?.status === "sent",
      reference: booking.reference,
      requirement: policy.requirement,
      feeCents: policy.feeCents,
      cardLast4: card?.cardLast4 ?? null,
      startAt: booking.startAt.toISOString(),
      partySize: booking.partySize,
      customerName: parsed.data.name,
      // The customer's own page: details, what they accepted, and the
      // one-tap dispute if a fee is ever collected.
      bookingUrl: `${baseUrl}/r/${booking.accessToken}`,
    };
  } catch (err) {
    if (err instanceof BookingError) {
      return { ok: false as const, error: err.message, code: err.code };
    }
    console.error("submitBooking failed", err);
    return { ok: false as const, error: "Ceva n-a mers. Încercați din nou." };
  }
}
