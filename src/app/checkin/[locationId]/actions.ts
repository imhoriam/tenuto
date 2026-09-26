"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { BOOKING_STATUS, CHECKIN_METHOD } from "@/lib/constants";
import { checkIn } from "@/lib/booking/service";
import { isWithinCheckInWindow, phoneTail, verifyVenueKey } from "@/lib/checkin";
import { timeIn } from "@/lib/format";

const schema = z.object({
  locationId: z.string().min(1),
  key: z.string().min(1),
  /** Either a phone number or a TNT-XXXXX booking reference. */
  lookup: z.string().min(3),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type CheckInResult =
  | {
      ok: true;
      reference: string;
      customerName: string;
      partySize: number;
      table: string;
      time: string;
      alreadyCheckedIn: boolean;
    }
  | { ok: false; error: string };

export async function checkInAtVenue(
  input: z.input<typeof schema>,
): Promise<CheckInResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Date invalide." };

  const location = await db.location.findUnique({
    where: { id: parsed.data.locationId },
    include: { business: true },
  });
  if (!location) return { ok: false, error: "Locație inexistentă." };

  // Possession of the key stands in for being at the venue. Without it the
  // page is just a URL anyone could guess.
  if (!verifyVenueKey(location.id, location.checkInSecret, parsed.data.key)) {
    return { ok: false, error: "Cod invalid. Scanați codul QR de la intrare." };
  }

  const raw = parsed.data.lookup.trim();
  const looksLikeReference = /^tnt-/i.test(raw);

  const candidates = await db.booking.findMany({
    where: {
      locationId: location.id,
      status: {
        in: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.NO_SHOW_PENDING],
      },
      ...(looksLikeReference
        ? { reference: raw.toUpperCase() }
        : { customer: { phone: { contains: phoneTail(raw) } } }),
    },
    include: { customer: true, resource: true },
    orderBy: { startAt: "asc" },
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      error: looksLikeReference
        ? "Nu găsim rezervarea cu acest cod."
        : "Nu găsim o rezervare pe acest număr.",
    };
  }

  const inWindow = candidates.filter((b) =>
    isWithinCheckInWindow(b.startAt, location.business.gracePeriodMin),
  );

  if (inWindow.length === 0) {
    const next = candidates[0];
    return {
      ok: false,
      error: `Rezervarea dumneavoastră este la ${timeIn(next.startAt, location.business.timezone)}. Scanați din nou mai aproape de oră.`,
    };
  }

  // If several match, take the one closest to now.
  const now = Date.now();
  const booking = inWindow.sort(
    (a, b) =>
      Math.abs(a.startAt.getTime() - now) - Math.abs(b.startAt.getTime() - now),
  )[0];

  const wasAlreadyIn = booking.status === BOOKING_STATUS.CHECKED_IN;

  try {
    await checkIn({
      bookingId: booking.id,
      method: CHECKIN_METHOD.QR,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    });
  } catch (err) {
    console.error("venue check-in failed", err);
    return { ok: false, error: "Nu am putut înregistra sosirea. Cereți ajutor la recepție." };
  }

  return {
    ok: true,
    reference: booking.reference,
    customerName: booking.customer.name,
    partySize: booking.partySize,
    table: booking.resource.name,
    time: timeIn(booking.startAt, location.business.timezone),
    alreadyCheckedIn: wasAlreadyIn,
  };
}
