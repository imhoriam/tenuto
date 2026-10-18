"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { BOOKING_STATUS, CHECKIN_METHOD } from "@/lib/constants";
import { authorizeBusiness } from "@/lib/auth/session";
import {
  BookingError,
  checkIn,
  collectDueCharges,
  releaseDuePayouts,
  sweepNoShows,
  waive,
} from "@/lib/booking/service";
import {
  ForbiddenActorError,
  InvalidTransitionError,
} from "@/lib/booking/state-machine";
import { money } from "@/lib/format";

const target = z.object({
  slug: z.string().min(1),
  bookingId: z.string().min(1),
});

type Result = { ok: true; message: string } | { ok: false; error: string };
type Owner = { id: string; currency: string; suspendedAt: Date | null };

/**
 * Every dashboard action runs through here: the session must own `slug`, and
 * a booking id must belong to that business — the id comes from the client
 * and is not trusted on its own.
 */
async function guard(
  slug: string,
  bookingId: string | null,
  fn: (business: Owner) => Promise<string>,
): Promise<Result> {
  const business = await authorizeBusiness(slug);
  if (!business) return { ok: false, error: "Sesiunea a expirat. Autentificați-vă din nou." };

  if (bookingId) {
    const owned = await db.booking.findFirst({
      where: { id: bookingId, businessId: business.id },
      select: { id: true },
    });
    if (!owned) return { ok: false, error: "Rezervare inexistentă." };
  }

  try {
    const message = await fn(business);
    revalidatePath(`/dashboard/${slug}`);
    return { ok: true, message };
  } catch (err) {
    if (
      err instanceof BookingError ||
      err instanceof InvalidTransitionError ||
      err instanceof ForbiddenActorError
    ) {
      return { ok: false, error: err.message };
    }
    console.error("dashboard action failed", err);
    return { ok: false, error: "Ceva n-a mers." };
  }
}

/** Staff vouch for someone. May only ever prevent a charge (invariant 2). */
export async function checkInAction(input: z.input<typeof target>): Promise<Result> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Date invalide." };

  return guard(parsed.data.slug, parsed.data.bookingId, async () => {
    const booking = await checkIn({
      bookingId: parsed.data.bookingId,
      method: CHECKIN_METHOD.MANUAL,
      actorLabel: "staff",
    });
    return `${booking.reference}: sosit. Nu se taxează nimic.`;
  });
}

export async function waiveAction(input: z.input<typeof target>): Promise<Result> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Date invalide." };

  return guard(parsed.data.slug, parsed.data.bookingId, async () => {
    const before = await db.booking.findUniqueOrThrow({ where: { id: parsed.data.bookingId } });
    const collected = before.status === BOOKING_STATUS.CHARGE_SUCCEEDED || before.status === BOOKING_STATUS.DISPUTED;
    const booking = await waive({
      bookingId: parsed.data.bookingId,
      actorLabel: "staff",
      reason: collected ? "rambursat de restaurant" : "iertat de restaurant",
    });
    return collected ? `${booking.reference}: rambursat integral clientului.` : `${booking.reference}: taxă iertată.`;
  });
}

/**
 * "Charge everyone": record any no-shows whose grace period has run out, then
 * collect every due fee of *this* restaurant, plus retries that are due. The
 * money is held for DISPUTE_WINDOW_DAYS before it is paid out.
 */
export async function chargeAllAction(input: { slug: string }): Promise<Result> {
  const slug = z.string().min(1).safeParse(input.slug);
  if (!slug.success) return { ok: false, error: "Date invalide." };

  return guard(slug.data, null, async (business) => {
    if (business.suspendedAt) {
      throw new BookingError("Contul e suspendat — încasările sunt oprite.", "suspended");
    }
    await sweepNoShows({ businessId: business.id });
    await releaseDuePayouts({ businessId: business.id });
    const results = await collectDueCharges(new Date(), { businessId: business.id });
    if (results.length === 0) return "Nicio taxă scadentă acum.";

    const charged = results.filter((r) => r.outcome === "charged");
    const failed = results.length - charged.length;

    const bookings = await db.booking.findMany({
      where: { reference: { in: charged.map((r) => r.reference) } },
      select: { feeCents: true },
    });
    const total = bookings.reduce((sum, b) => sum + b.feeCents, 0);

    return [
      charged.length > 0
        ? `Încasat ${money(total, business.currency)} din ${charged.length} ${charged.length === 1 ? "neprezentare" : "neprezentări"}.`
        : null,
      failed > 0 ? `${failed} ${failed === 1 ? "card refuzat" : "carduri refuzate"} — vezi detaliile în listă.` : null,
    ]
      .filter(Boolean)
      .join(" ");
  });
}
