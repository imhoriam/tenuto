import { test } from "node:test";
import assert from "node:assert/strict";

import {
  type AvailabilityInput,
  generateSlots,
  localMinutesToUtc,
  overlaps,
  pickResource,
} from "./availability";

const TZ = "Europe/Bucharest";

/** Dinner: 2h seating, 15 min to reset the table afterwards. */
const DINNER = {
  durationMin: 120,
  bufferBeforeMin: 0,
  bufferAfterMin: 15,
  usesPartySize: true,
};

/** Open 18:00-23:00 every day. 1080 = 18:00, 1380 = 23:00. */
const everyDay = (startMinute = 1080, endMinute = 1380) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    resourceId: null,
    weekday,
    startMinute,
    endMinute,
  }));

const TABLES = [
  { id: "t2a", capacity: 2 },
  { id: "t2b", capacity: 2 },
  { id: "t4", capacity: 4 },
  { id: "t6", capacity: 6 },
];

function baseInput(over: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    timezone: TZ,
    service: DINNER,
    resources: TABLES,
    scheduleRules: everyDay(),
    timeOff: [],
    bookings: [],
    partySize: 2,
    slotIntervalMin: 30,
    from: new Date("2026-10-20T00:00:00Z"),
    to: new Date("2026-10-20T23:59:59Z"),
    notBefore: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

test("overlap is half-open — back-to-back bookings do not clash", () => {
  const a1 = new Date("2026-10-20T18:00:00Z");
  const a2 = new Date("2026-10-20T20:00:00Z");
  const b1 = new Date("2026-10-20T20:00:00Z");
  const b2 = new Date("2026-10-20T22:00:00Z");
  assert.equal(overlaps(a1, a2, b1, b2), false);
  assert.equal(overlaps(a1, a2, new Date("2026-10-20T19:59:00Z"), b2), true);
});

test("slots are generated across the opening window", () => {
  const slots = generateSlots(baseInput());
  // 18:00 to 21:00 start times at 30 min steps (last 2h service ends 23:00).
  assert.equal(slots.length, 7);
  assert.equal(slots[0].startAt.toISOString(), "2026-10-20T15:00:00.000Z"); // 18:00 +03
  assert.equal(slots.at(-1)!.startAt.toISOString(), "2026-10-20T18:00:00.000Z"); // 21:00 +03
});

test("a service that would run past closing is not offered", () => {
  const slots = generateSlots(baseInput());
  const lastEnd = slots.at(-1)!.endAt;
  // 23:00 local on 2026-10-20 (+03) is 20:00 UTC.
  assert.equal(lastEnd.toISOString(), "2026-10-20T20:00:00.000Z");
});

test("opening hours stay at 18:00 local across the DST change", () => {
  // EU clocks go back on Sunday 25 October 2026.
  const before = generateSlots(
    baseInput({
      from: new Date("2026-10-24T00:00:00Z"),
      to: new Date("2026-10-24T23:59:59Z"),
    }),
  );
  const after = generateSlots(
    baseInput({
      from: new Date("2026-10-26T00:00:00Z"),
      to: new Date("2026-10-26T23:59:59Z"),
    }),
  );

  // Same wall-clock opening, different UTC instant: +03 before, +02 after.
  assert.equal(before[0].startAt.toISOString(), "2026-10-24T15:00:00.000Z");
  assert.equal(after[0].startAt.toISOString(), "2026-10-26T16:00:00.000Z");

  // And the same number of slots on both days — a DST day is still one day.
  assert.equal(before.length, after.length);
});

test("a venue open past midnight offers late slots on the right calendar day", () => {
  // Open 18:00 to 01:00 => endMinute 1500.
  const slots = generateSlots(
    baseInput({
      scheduleRules: everyDay(1080, 1500),
      service: { ...DINNER, durationMin: 60, bufferAfterMin: 0 },
    }),
  );
  const last = slots.at(-1)!;
  // Last 1h service starts 00:00 local on the 21st, ends 01:00.
  assert.equal(last.startAt.toISOString(), "2026-10-20T21:00:00.000Z");
  assert.equal(last.endAt.toISOString(), "2026-10-20T22:00:00.000Z");
});

test("a party of six only sees tables that fit", () => {
  const slots = generateSlots(baseInput({ partySize: 6 }));
  assert.ok(slots.length > 0);
  for (const slot of slots) {
    assert.deepEqual(slot.availableResourceIds, ["t6"]);
  }
});

test("a party larger than every table gets nothing", () => {
  const slots = generateSlots(baseInput({ partySize: 9 }));
  assert.equal(slots.length, 0);
});

test("an existing booking blocks its table, including the turnaround buffer", () => {
  // t2a booked 18:00-20:15 local (+03) = 15:00-17:15 UTC, buffer included.
  const slots = generateSlots(
    baseInput({
      bookings: [
        {
          resourceId: "t2a",
          startAt: new Date("2026-10-20T15:00:00Z"),
          endAt: new Date("2026-10-20T17:15:00Z"),
        },
      ],
    }),
  );

  const at1800 = slots.find(
    (s) => s.startAt.toISOString() === "2026-10-20T15:00:00.000Z",
  )!;
  assert.ok(!at1800.availableResourceIds.includes("t2a"));
  assert.ok(at1800.availableResourceIds.includes("t2b"));

  // 20:30 local (17:30 UTC) is clear of the 20:15 buffer end.
  const at2030 = slots.find(
    (s) => s.startAt.toISOString() === "2026-10-20T17:30:00.000Z",
  )!;
  assert.ok(at2030.availableResourceIds.includes("t2a"));
});

test("business-wide time off blocks every table", () => {
  const slots = generateSlots(
    baseInput({
      timeOff: [
        {
          resourceId: null,
          startAt: new Date("2026-10-20T00:00:00Z"),
          endAt: new Date("2026-10-21T00:00:00Z"),
        },
      ],
    }),
  );
  assert.equal(slots.length, 0);
});

test("a closed weekday produces no slots", () => {
  // Open only on Mondays (weekday 1); 2026-10-20 is a Tuesday.
  const slots = generateSlots(
    baseInput({
      scheduleRules: [
        { resourceId: null, weekday: 1, startMinute: 1080, endMinute: 1380 },
      ],
    }),
  );
  assert.equal(slots.length, 0);
});

test("slots in the past are not offered", () => {
  const slots = generateSlots(
    baseInput({ notBefore: new Date("2026-10-20T17:00:00Z") }), // 20:00 local
  );
  assert.ok(slots.every((s) => s.startAt >= new Date("2026-10-20T17:00:00Z")));
  assert.equal(slots[0].startAt.toISOString(), "2026-10-20T17:00:00.000Z");
});

test("a two-top does not consume the only six-top", () => {
  const slot = {
    startAt: new Date(),
    endAt: new Date(),
    occupiedStart: new Date(),
    occupiedEnd: new Date(),
    availableResourceIds: ["t2a", "t4", "t6"],
  };
  assert.equal(pickResource(slot, TABLES, 2, true), "t2a");
  assert.equal(pickResource(slot, TABLES, 3, true), "t4");
  assert.equal(pickResource(slot, TABLES, 5, true), "t6");
  assert.equal(pickResource(slot, TABLES, 7, true), null);
});

test("local minutes convert to the right UTC instant either side of DST", () => {
  // 18:00 local, October 2026.
  assert.equal(
    localMinutesToUtc(2026, 9, 24, 1080, TZ).toISOString(),
    "2026-10-24T15:00:00.000Z", // +03
  );
  assert.equal(
    localMinutesToUtc(2026, 9, 26, 1080, TZ).toISOString(),
    "2026-10-26T16:00:00.000Z", // +02
  );
});
