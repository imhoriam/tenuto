"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { REQUIREMENT, VERTICAL } from "@/lib/constants";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { slugify } from "@/lib/business-profile";

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

const LOGIN_NAME = /^[a-z0-9._-]{3,32}$/;

const registerSchema = z
  .object({
    restaurantName: z.string().trim().min(2, "Numele restaurantului este prea scurt.").max(80),
    loginName: z
      .string()
      .trim()
      .toLowerCase()
      .regex(LOGIN_NAME, "Numele de utilizator: 3–32 caractere, litere mici, cifre, punct, cratimă."),
    password: z.string().min(MIN_PASSWORD_LENGTH, `Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere.`),
    passwordConfirm: z.string(),
    acceptTerms: z.literal("on", { message: "Trebuie să acceptați termenii." }),
  })
  .refine((v) => v.password === v.passwordConfirm, { message: "Parolele nu coincid." });

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let n = 1; n < 100; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await db.business.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Create a restaurant and its login in one go. The restaurant is fully wired
 * (location, a default service, the default policy rules) but unpublished:
 * it only appears in search once the profile is complete.
 */
export async function registerRestaurant(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = registerSchema.safeParse(raw);
  const fields = { restaurantName: raw.restaurantName ?? "", loginName: raw.loginName ?? "" };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fields };

  const { restaurantName, loginName, password } = parsed.data;

  if (await db.account.findUnique({ where: { loginName } })) {
    return { error: "Acest nume de utilizator este deja folosit.", fields };
  }

  const slug = await uniqueSlug(restaurantName);
  const passwordHash = await hashPassword(password);

  const account = await db.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        slug,
        name: restaurantName,
        vertical: VERTICAL.RESTAURANT,
        published: false,
        locations: { create: { name: "Principal" } },
        services: {
          create: {
            name: "Masă",
            description: "Masă rezervată pentru 2 ore.",
            durationMin: 120,
            bufferAfterMin: 15,
            usesPartySize: true,
          },
        },
        // The defaults are a product opinion (CLAUDE.md §4, §5.1): most
        // operators never tune them.
        policyRules: {
          create: [
            { name: "Clienții fideli rezervă fără card", priority: 10, minCompletedHere: 3, requirement: REQUIREMENT.NONE },
            {
              name: "Cine a mai lipsit lasă un avans",
              priority: 20,
              hasNoShowHistory: true,
              requirement: REQUIREMENT.DEPOSIT,
              feeCentsOverride: 10000,
            },
            {
              name: "Grupurile mari lasă card",
              priority: 30,
              minPartySize: 6,
              requirement: REQUIREMENT.CARD_ON_FILE,
              feeCentsOverride: 15000,
            },
            { name: "Toți ceilalți lasă card", priority: 100, requirement: REQUIREMENT.CARD_ON_FILE },
          ],
        },
      },
    });

    return tx.account.create({ data: { loginName, passwordHash, businessId: business.id } });
  });

  await createSession(account.id);
  redirect(`/dashboard/${slug}/settings?welcome=1`);
}

const loginSchema = z.object({
  loginName: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

// Verified against when the login name does not exist, so an unknown user and
// a wrong password take the same time.
const DUMMY_HASH = hashPassword("tenuto-timing-equaliser");

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = loginSchema.safeParse(raw);
  const fields = { loginName: raw.loginName ?? "" };
  if (!parsed.success) return { error: "Completați numele de utilizator și parola.", fields };

  const account = await db.account.findUnique({
    where: { loginName: parsed.data.loginName },
    include: { business: { select: { slug: true } } },
  });

  const ok = await verifyPassword(parsed.data.password, account?.passwordHash ?? (await DUMMY_HASH));
  if (!account || !ok) return { error: "Nume de utilizator sau parolă greșite.", fields };

  await createSession(account.id);

  // Only follow `next` into this account's own dashboard, or back to a scanned
  // arrival code (that page checks ownership itself) — never an open redirect.
  const own = `/dashboard/${account.business.slug}`;
  const next = parsed.data.next;
  const safe = next && (next === own || next.startsWith(`${own}/`) || /^\/sosire\/[A-Za-z0-9_-]{16,64}$/.test(next));
  redirect(safe ? next : own);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
