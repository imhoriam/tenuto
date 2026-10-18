"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { CHECKIN_METHOD } from "@/lib/constants";
import { getCurrentAccount } from "@/lib/auth/session";
import { BookingError, checkIn } from "@/lib/booking/service";
import { InvalidTransitionError } from "@/lib/booking/state-machine";

export type ScanState = { ok?: boolean; error?: string } | undefined;

/**
 * The host scanned the customer's QR and confirmed. A staff check-in: it can
 * only ever prevent a charge (invariant 2), and it is recorded as a scan so a
 * dispute can see the exact minute.
 */
export async function confirmScannedArrival(_prev: ScanState, formData: FormData): Promise<ScanState> {
  const token = String(formData.get("token") ?? "");
  const account = await getCurrentAccount();
  if (!account) return { error: "Sesiunea a expirat. Autentifică-te din nou." };

  const booking = await db.booking.findUnique({ where: { accessToken: token }, select: { id: true, businessId: true } });
  if (!booking || booking.businessId !== account.businessId) {
    return { error: "Această rezervare nu este la restaurantul tău." };
  }

  try {
    await checkIn({ bookingId: booking.id, method: CHECKIN_METHOD.MANUAL, actorLabel: "scanare QR" });
  } catch (err) {
    if (err instanceof BookingError || err instanceof InvalidTransitionError) {
      return { error: "Sosirea nu mai poate fi confirmată pentru această rezervare." };
    }
    throw err;
  }
  revalidatePath(`/dashboard/${account.business.slug}`);
  return { ok: true };
}
