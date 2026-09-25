import { TZDate } from "@date-fns/tz";

/**
 * Slot generation.
 *
 * Everything here is pure: it takes already-loaded rows and returns slots, so
 * it can be tested without a database. The caller is responsible for loading
 * only bookings in BLOCKING_STATUSES.
 *
 * Time handling rules, which exist because this is where booking systems rot:
 *  - Schedule rules store *local* minutes from midnight, not instants. 18:00
 *    stays 18:00 either side of a DST change; the UTC instant moves instead.
 *  - endMinute may exceed 1440 for venues open past midnight (a kitchen open
 *    until 01:00 has endMinute 1500). TZDate handles the day rollover.
 *  - Every Date returned is a true UTC instant.
 */

export interface ServiceShape {
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  /** Restaurants: party size must fit the table. Detailing: booking takes the bay. */
  usesPartySize: boolean;
}

export interface ResourceShape {
  id: string;
  capacity: number;
}

export interface ScheduleRuleShape {
  /** null = applies to every resource in the business. */
  resourceId: string | null;
  weekday: number; // 0 = Sunday
  startMinute: number;
  endMinute: number;
}

export interface IntervalShape {
  /** null = blocks every resource (e.g. a public holiday). */
  resourceId: string | null;
  startAt: Date;
  endAt: Date;
}

export interface BookingShape {
  resourceId: string;
  /** Occupied window — buffers already included. */
  startAt: Date;
  endAt: Date;
}

export interface AvailabilityInput {
  timezone: string;
  service: ServiceShape;
  resources: ResourceShape[];
  scheduleRules: ScheduleRuleShape[];
  timeOff: IntervalShape[];
  bookings: BookingShape[];
  partySize: number;
  /** How far apart slot start times are. 15 or 30 for most venues. */
  slotIntervalMin: number;
  /**
   * The instant window to return slots for. Local days touching this window
   * are generated, then slots are clipped back to it — otherwise a `to` of
   * 23:59:59Z leaks the next local day in any zone east of UTC.
   */
  from: Date;
  to: Date;
  /** Slots starting before this are dropped. Defaults to now. */
  notBefore?: Date;
}

export interface Slot {
  /** What the customer sees and books. */
  startAt: Date;
  endAt: Date;
  /** What actually blocks the resource — buffers included. */
  occupiedStart: Date;
  occupiedEnd: Date;
  /** Resources that could take this slot. Empty means unavailable. */
  availableResourceIds: string[];
}

/** Half-open overlap: [aStart, aEnd) vs [bStart, bEnd). */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Turn a local calendar date plus minutes-from-midnight into a UTC instant,
 * honouring whatever offset that zone had on that date.
 */
export function localMinutesToUtc(
  year: number,
  monthIndex: number,
  day: number,
  minutesFromMidnight: number,
  timezone: string,
): Date {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  // Hours >= 24 roll into the following day, which is what a venue open until
  // 01:00 needs.
  const tz = new TZDate(year, monthIndex, day, hours, minutes, 0, timezone);
  return new Date(tz.getTime());
}

/** Local calendar days in [from, to], as seen in `timezone`. */
function eachLocalDay(
  from: Date,
  to: Date,
  timezone: string,
): Array<{ year: number; monthIndex: number; day: number; weekday: number }> {
  const days: Array<{
    year: number;
    monthIndex: number;
    day: number;
    weekday: number;
  }> = [];

  const cursor = new TZDate(from.getTime(), timezone);
  const last = new TZDate(to.getTime(), timezone);

  let year = cursor.getFullYear();
  let monthIndex = cursor.getMonth();
  let day = cursor.getDate();

  const endKey =
    last.getFullYear() * 10000 + (last.getMonth() + 1) * 100 + last.getDate();

  // Step by calendar date rather than by 24h, so a DST day is still one day.
  for (let guard = 0; guard < 400; guard += 1) {
    const key = year * 10000 + (monthIndex + 1) * 100 + day;
    if (key > endKey) break;

    const atNoon = new TZDate(year, monthIndex, day, 12, 0, 0, timezone);
    days.push({ year, monthIndex, day, weekday: atNoon.getDay() });

    const next = new TZDate(year, monthIndex, day + 1, 12, 0, 0, timezone);
    year = next.getFullYear();
    monthIndex = next.getMonth();
    day = next.getDate();
  }

  return days;
}

/** Rules that govern a given resource: its own, plus business-wide ones. */
function rulesForResource(
  rules: ScheduleRuleShape[],
  resourceId: string,
  weekday: number,
): ScheduleRuleShape[] {
  return rules.filter(
    (r) =>
      r.weekday === weekday &&
      (r.resourceId === null || r.resourceId === resourceId),
  );
}

function isWithinAnyRule(
  rules: ScheduleRuleShape[],
  startMinute: number,
  endMinute: number,
): boolean {
  return rules.some(
    (r) => startMinute >= r.startMinute && endMinute <= r.endMinute,
  );
}

export function generateSlots(input: AvailabilityInput): Slot[] {
  const {
    timezone,
    service,
    resources,
    scheduleRules,
    timeOff,
    bookings,
    partySize,
    slotIntervalMin,
    from,
    to,
  } = input;

  const notBefore = input.notBefore ?? new Date();
  const slots: Slot[] = [];

  // A resource too small for the party can never work — filter once, up front.
  const eligibleResources = service.usesPartySize
    ? resources.filter((r) => r.capacity >= partySize)
    : resources;

  if (eligibleResources.length === 0) return slots;

  const bookingsByResource = new Map<string, BookingShape[]>();
  for (const b of bookings) {
    const list = bookingsByResource.get(b.resourceId);
    if (list) list.push(b);
    else bookingsByResource.set(b.resourceId, [b]);
  }

  for (const { year, monthIndex, day, weekday } of eachLocalDay(
    from,
    to,
    timezone,
  )) {
    // The widest window any rule opens today, so we know where to start/stop.
    const todaysRules = scheduleRules.filter((r) => r.weekday === weekday);
    if (todaysRules.length === 0) continue;

    const dayStart = Math.min(...todaysRules.map((r) => r.startMinute));
    const dayEnd = Math.max(...todaysRules.map((r) => r.endMinute));

    for (
      let minute = dayStart;
      minute + service.durationMin <= dayEnd;
      minute += slotIntervalMin
    ) {
      const startAt = localMinutesToUtc(
        year,
        monthIndex,
        day,
        minute,
        timezone,
      );
      const endAt = localMinutesToUtc(
        year,
        monthIndex,
        day,
        minute + service.durationMin,
        timezone,
      );
      const occupiedStart = localMinutesToUtc(
        year,
        monthIndex,
        day,
        minute - service.bufferBeforeMin,
        timezone,
      );
      const occupiedEnd = localMinutesToUtc(
        year,
        monthIndex,
        day,
        minute + service.durationMin + service.bufferAfterMin,
        timezone,
      );

      // Clip to the requested window. eachLocalDay deliberately over-generates
      // at the edges so a venue open past midnight keeps its late slots.
      if (startAt < from || startAt > to) continue;
      if (startAt < notBefore) continue;

      const availableResourceIds: string[] = [];

      for (const resource of eligibleResources) {
        const rules = rulesForResource(scheduleRules, resource.id, weekday);
        if (rules.length === 0) continue;

        // The *service* must fit the opening hours. Buffers may spill outside
        // them — cleaning a table after close is fine.
        if (!isWithinAnyRule(rules, minute, minute + service.durationMin)) {
          continue;
        }

        const blockedByTimeOff = timeOff.some(
          (t) =>
            (t.resourceId === null || t.resourceId === resource.id) &&
            overlaps(occupiedStart, occupiedEnd, t.startAt, t.endAt),
        );
        if (blockedByTimeOff) continue;

        const existing = bookingsByResource.get(resource.id) ?? [];
        const clash = existing.some((b) =>
          overlaps(occupiedStart, occupiedEnd, b.startAt, b.endAt),
        );
        if (clash) continue;

        availableResourceIds.push(resource.id);
      }

      if (availableResourceIds.length > 0) {
        slots.push({
          startAt,
          endAt,
          occupiedStart,
          occupiedEnd,
          availableResourceIds,
        });
      }
    }
  }

  return slots;
}

/**
 * Which resource to actually give a booking.
 *
 * Smallest table that fits, so a two-top doesn't eat the only six-top. This is
 * the single highest-value line in the file for a restaurant: it is the
 * difference between turning away a party of six at 20:00 and seating them.
 */
export function pickResource(
  slot: Slot,
  resources: ResourceShape[],
  partySize: number,
  usesPartySize: boolean,
): string | null {
  const candidates = resources.filter((r) =>
    slot.availableResourceIds.includes(r.id),
  );
  if (candidates.length === 0) return null;
  if (!usesPartySize) return candidates[0].id;

  return candidates
    .filter((r) => r.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id))[0]
    ?.id ?? null;
}
