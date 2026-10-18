import { timingSafeEqual } from "node:crypto";

/**
 * Tenuto staff access to /admin, for resolving disputes and suspending
 * restaurants. HTTP Basic auth against TENUTO_ADMIN_PASSWORD (user "tenuto").
 * With no password configured the admin area does not exist at all.
 *
 * Deliberately separate from restaurant accounts: a restaurant login must
 * never be able to rule on disputes against itself.
 */
export const ADMIN_USER = "tenuto";

export function adminEnabled(): boolean {
  return Boolean(process.env.TENUTO_ADMIN_PASSWORD);
}

export function isAdminAuthorization(header: string | null | undefined): boolean {
  const password = process.env.TENUTO_ADMIN_PASSWORD;
  if (!password || !header?.startsWith("Basic ")) return false;

  const expected = Buffer.from(`${ADMIN_USER}:${password}`);
  const actual = Buffer.from(Buffer.from(header.slice(6), "base64").toString("utf8"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
