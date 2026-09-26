import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";

/**
 * Database sessions for restaurant accounts.
 *
 * The cookie holds a random token; the database holds only its SHA-256. Every
 * check reads the database, so logging out or deleting an account takes effect
 * on the next request — there is no signed cookie that stays valid until it
 * expires.
 *
 * Authorisation lives here, next to the data, rather than in a Proxy: every
 * dashboard page and every dashboard action calls one of the functions below.
 */

const COOKIE = "tenuto_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(accountId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db.session.create({ data: { id: digest(token), accountId, expiresAt } });
  await db.account.update({ where: { id: accountId }, data: { lastLoginAt: new Date() } });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: digest(token) } });
  store.delete(COOKIE);
}

/** The logged-in restaurant account, or null. Memoised per request. */
export const getCurrentAccount = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: digest(token) },
    include: { account: { include: { business: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return session.account;
});

/**
 * For pages: the business behind `slug`, provided the current account owns it.
 * Redirects to login when signed out, and to the account's own dashboard when
 * signed in as a different restaurant.
 */
export async function requireBusiness(slug: string) {
  const account = await getCurrentAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(`/dashboard/${slug}`)}`);
  if (account.business.slug !== slug) redirect(`/dashboard/${account.business.slug}`);
  return account.business;
}

/**
 * For server actions: same check, but returns null instead of redirecting —
 * actions report refusals as results, and a redirect thrown inside a
 * try/catch would be swallowed as an ordinary error.
 */
export async function authorizeBusiness(slug: string) {
  const account = await getCurrentAccount();
  if (!account || account.business.slug !== slug) return null;
  return account.business;
}
