import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Venue check-in tokens.
 *
 * The printed QR code at the entrance encodes:
 *
 *     https://host/checkin/<locationId>?k=<venueKey>
 *
 * `venueKey` is an HMAC of the location id under that location's
 * `checkInSecret`. The secret never leaves the server, and the key is stable,
 * so the code can be printed once and stuck to a door.
 *
 * What this does and does not prove
 * ---------------------------------
 * Possession of the key proves the person has *seen the printed code*, which in
 * practice means they were at the venue. That is the point: it stops a customer
 * checking themselves in from home, which is the attack that matters, because
 * check-in is the one action that cancels a no-show charge (invariant 3).
 *
 * It is not unforgeable. Someone could photograph the code and send it to a
 * friend. Three things bound the damage:
 *
 *  1. Check-in is only accepted inside a window around the booking (see
 *     `isWithinCheckInWindow`), so a leaked key is not a standing pass.
 *  2. Geolocation is recorded when the browser offers it — corroborating
 *     evidence in a dispute, deliberately not a gate, because indoor GPS is
 *     unreliable and a false refusal is worse than a false accept here.
 *  3. Rotating a location's `checkInSecret` invalidates every old code at once.
 *
 * The asymmetry is intentional. A wrongly-accepted check-in costs the business
 * one no-show fee. A wrongly-refused check-in charges someone who actually
 * turned up, which is the failure that loses a customer and earns a chargeback.
 */

const KEY_LENGTH = 16;

export function venueKey(locationId: string, checkInSecret: string): string {
  return createHmac("sha256", checkInSecret)
    .update(locationId)
    .digest("hex")
    .slice(0, KEY_LENGTH);
}

export function verifyVenueKey(
  locationId: string,
  checkInSecret: string,
  provided: string | null | undefined,
): boolean {
  if (!provided || provided.length !== KEY_LENGTH) return false;

  const expected = Buffer.from(venueKey(locationId, checkInSecret), "utf8");
  const actual = Buffer.from(provided, "utf8");
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}

export function checkInUrl(
  origin: string,
  locationId: string,
  checkInSecret: string,
): string {
  const url = new URL(`/checkin/${locationId}`, origin);
  url.searchParams.set("k", venueKey(locationId, checkInSecret));
  return url.toString();
}

/** Opens an hour early; stays open well past the grace period. */
export const CHECKIN_OPENS_BEFORE_MS = 60 * 60 * 1000;
export const CHECKIN_CLOSES_AFTER_GRACE_MS = 2 * 60 * 60 * 1000;

export function checkInWindow(startAt: Date, gracePeriodMin: number) {
  return {
    opens: new Date(startAt.getTime() - CHECKIN_OPENS_BEFORE_MS),
    closes: new Date(
      startAt.getTime() +
        gracePeriodMin * 60_000 +
        CHECKIN_CLOSES_AFTER_GRACE_MS,
    ),
  };
}

export function isWithinCheckInWindow(
  startAt: Date,
  gracePeriodMin: number,
  now: Date = new Date(),
): boolean {
  const { opens, closes } = checkInWindow(startAt, gracePeriodMin);
  return now >= opens && now <= closes;
}

/** Phone numbers get typed with spaces, dashes and brackets. Strip to compare. */
export function normalisePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

/**
 * Match on the last 9 digits so +40721111111, 0721111111 and 0721 111 111 all
 * find the same person. Romanian mobile numbers are 9 digits after the prefix.
 */
export function phoneTail(input: string, length = 9): string {
  return normalisePhone(input).replace(/\D/g, "").slice(-length);
}
