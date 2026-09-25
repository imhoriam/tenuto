/** Presentation helpers. All formatting happens in the business's timezone. */

export function money(cents: number, currency: string, locale = "ro-RO"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function timeIn(date: Date, timezone: string, locale = "ro-RO"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function dayIn(date: Date, timezone: string, locale = "ro-RO"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function shortDayIn(date: Date, timezone: string, locale = "ro-RO"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/** "in 12 min" / "25 min ago", for the live dashboard. */
export function relativeMinutes(target: Date, now: Date = new Date()): string {
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60_000);
  const abs = Math.abs(diffMin);

  if (abs < 1) return "acum";
  if (abs < 60) return diffMin > 0 ? `în ${abs} min` : `acum ${abs} min`;

  const hours = Math.round(abs / 60);
  if (hours < 24) return diffMin > 0 ? `în ${hours} h` : `acum ${hours} h`;

  const days = Math.round(hours / 24);
  return diffMin > 0 ? `în ${days} z` : `acum ${days} z`;
}

/** YYYY-MM-DD as seen in a given timezone — for date inputs. */
export function isoDateIn(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
