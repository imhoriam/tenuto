"use server";

import { revalidatePath } from "next/cache";

import { BookingError, openDispute } from "@/lib/booking/service";

export type DisputeState = { ok?: boolean; error?: string } | undefined;

const MESSAGES: Record<string, string> = {
  not_charged: "Nu există nicio taxă încasată pentru această rezervare.",
  dispute_window_closed: "Termenul de contestare a trecut. Poți contesta tranzacția direct la banca ta.",
  no_booking: "Nu găsim această rezervare.",
};

/** The customer's one-tap dispute. Freezes the money until it is resolved. */
export async function disputeFee(_prev: DisputeState, formData: FormData): Promise<DisputeState> {
  const token = String(formData.get("token") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (token.length < 16) return { error: MESSAGES.no_booking };

  try {
    await openDispute({ accessToken: token, reason });
  } catch (err) {
    if (err instanceof BookingError) return { error: MESSAGES[err.code] ?? err.message };
    console.error("dispute failed", err);
    return { error: "Nu am putut înregistra contestația. Încearcă din nou." };
  }
  revalidatePath(`/r/${token}`);
  return { ok: true };
}
