"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";

export type LookupState = { error?: string; reference?: string } | undefined;

/** Last 9 digits: +40721111111, 0721111111 and 0721 111 111 are the same person. */
const tail = (phone: string) => phone.replace(/\D/g, "").slice(-9);

/**
 * Find a booking by its code and the phone number it was made with. Both are
 * required, so a guessed code alone reveals nothing.
 */
export async function findBooking(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const reference = String(formData.get("reference") ?? "").trim().toUpperCase().replace(/^(TNT)?-?/, "TNT-");
  const phone = String(formData.get("phone") ?? "");
  if (!/^TNT-[A-Z0-9]{5}$/.test(reference) || tail(phone).length < 9) {
    return { error: "Verifică codul (ex. TNT-4F7K2) și numărul de telefon.", reference };
  }

  const booking = await db.booking.findUnique({
    where: { reference },
    select: { accessToken: true, customer: { select: { phone: true } } },
  });
  if (!booking?.accessToken || tail(booking.customer.phone) !== tail(phone)) {
    return { error: "Nu găsim o rezervare cu acest cod și acest număr.", reference };
  }
  redirect(`/r/${booking.accessToken}`);
}
