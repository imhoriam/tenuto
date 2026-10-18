"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { ACTOR } from "@/lib/constants";
import { isAdminAuthorization } from "@/lib/auth/admin";
import { resolveDispute, setSuspended } from "@/lib/booking/service";

async function assertAdmin() {
  if (!isAdminAuthorization((await headers()).get("authorization"))) {
    throw new Error("Not authorised.");
  }
}

export async function resolveDisputeAction(formData: FormData): Promise<void> {
  await assertAdmin();
  const outcome = formData.get("outcome") === "uphold" ? "uphold" : "refund";
  await resolveDispute({
    bookingId: String(formData.get("bookingId")),
    outcome,
    actor: ACTOR.PLATFORM,
    actorLabel: "tenuto-admin",
    note: String(formData.get("note") ?? "").trim() || undefined,
  });
  revalidatePath("/admin");
}

export async function setSuspendedAction(formData: FormData): Promise<void> {
  await assertAdmin();
  await setSuspended({ businessId: String(formData.get("businessId")), suspended: formData.get("suspend") === "1" });
  revalidatePath("/admin");
}
