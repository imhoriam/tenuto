"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CHECKIN_METHOD } from "@/lib/constants";
import {
  BookingError,
  checkIn,
  collectDueCharges,
  markNoShow,
  waive,
} from "@/lib/booking/service";
import {
  ForbiddenActorError,
  InvalidTransitionError,
} from "@/lib/booking/state-machine";

const target = z.object({
  slug: z.string().min(1),
  bookingId: z.string().min(1),
});

type Result = { ok: true; message: string } | { ok: false; error: string };

/** Turn the domain's own refusals into something a host can read. */
async function guard(slug: string, fn: () => Promise<string>): Promise<Result> {
  try {
    const message = await fn();
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

export async function markAbsentAction(input: z.input<typeof target>): Promise<Result> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Date invalide." };

  return guard(parsed.data.slug, async () => {
    const booking = await markNoShow({
      bookingId: parsed.data.bookingId,
      actorLabel: "staff",
    });
    return `${booking.reference}: marcat absent. Taxarea pornește în 2 h.`;
  });
}

export async function checkInAction(input: z.input<typeof target>): Promise<Result> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Date invalide." };

  return guard(parsed.data.slug, async () => {
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

  return guard(parsed.data.slug, async () => {
    const booking = await waive({
      bookingId: parsed.data.bookingId,
      actorLabel: "staff",
      reason: "anulat de restaurant",
    });
    return `${booking.reference}: taxă anulată.`;
  });
}

/**
 * Demo affordance for the scheduled job. In production this is a cron worker,
 * not a button — but showing the charge actually fire is the point of the demo.
 */
export async function runCollectionAction(input: { slug: string }): Promise<Result> {
  const slug = z.string().min(1).safeParse(input.slug);
  if (!slug.success) return { ok: false, error: "Date invalide." };

  return guard(slug.data, async () => {
    const results = await collectDueCharges();
    if (results.length === 0) return "Nimic de încasat acum.";
    return results.map((r) => `${r.reference}: ${r.outcome}`).join(" · ");
  });
}
