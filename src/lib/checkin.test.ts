import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkInUrl,
  checkInWindow,
  isWithinCheckInWindow,
  normalisePhone,
  phoneTail,
  venueKey,
  verifyVenueKey,
} from "./checkin";

const LOC = "loc_abc123";
const SECRET = "s3cr3t-for-this-location";

test("the venue key is stable, so a printed code keeps working", () => {
  assert.equal(venueKey(LOC, SECRET), venueKey(LOC, SECRET));
});

test("a different location or secret yields a different key", () => {
  assert.notEqual(venueKey(LOC, SECRET), venueKey("loc_other", SECRET));
  assert.notEqual(venueKey(LOC, SECRET), venueKey(LOC, "rotated-secret"));
});

test("a valid key verifies", () => {
  assert.equal(verifyVenueKey(LOC, SECRET, venueKey(LOC, SECRET)), true);
});

test("a guessed, empty or wrong-length key is refused", () => {
  assert.equal(verifyVenueKey(LOC, SECRET, null), false);
  assert.equal(verifyVenueKey(LOC, SECRET, ""), false);
  assert.equal(verifyVenueKey(LOC, SECRET, "deadbeef"), false); // too short
  assert.equal(verifyVenueKey(LOC, SECRET, "0".repeat(16)), false);
  assert.equal(verifyVenueKey(LOC, SECRET, "0".repeat(64)), false); // too long
});

test("a key from another location does not open this one", () => {
  const other = venueKey("loc_other", SECRET);
  assert.equal(verifyVenueKey(LOC, SECRET, other), false);
});

test("rotating the secret invalidates every printed code at once", () => {
  const printed = venueKey(LOC, SECRET);
  assert.equal(verifyVenueKey(LOC, "rotated-secret", printed), false);
});

test("the check-in URL carries the location and key", () => {
  const url = new URL(checkInUrl("https://tenuto.app", LOC, SECRET));
  assert.equal(url.pathname, `/checkin/${LOC}`);
  assert.equal(url.searchParams.get("k"), venueKey(LOC, SECRET));
});

test("check-in opens an hour early and closes well after the grace period", () => {
  const startAt = new Date("2026-10-01T18:00:00Z");
  const { opens, closes } = checkInWindow(startAt, 15);

  assert.equal(opens.toISOString(), "2026-10-01T17:00:00.000Z");
  // 18:00 + 15 min grace + 2h = 20:15
  assert.equal(closes.toISOString(), "2026-10-01T20:15:00.000Z");
});

test("the late arrival is still inside the window", () => {
  const startAt = new Date("2026-10-01T18:00:00Z");
  // 20:25 local for a 20:00 booking — the case invariant 3 exists for.
  const at2025 = new Date("2026-10-01T18:25:00Z");
  assert.equal(isWithinCheckInWindow(startAt, 15, at2025), true);
});

test("check-in is refused far too early or far too late", () => {
  const startAt = new Date("2026-10-01T18:00:00Z");
  assert.equal(
    isWithinCheckInWindow(startAt, 15, new Date("2026-10-01T16:00:00Z")),
    false,
  );
  assert.equal(
    isWithinCheckInWindow(startAt, 15, new Date("2026-10-01T21:00:00Z")),
    false,
  );
});

test("phone numbers normalise across the formats people actually type", () => {
  assert.equal(normalisePhone(" +40 721 111 111 "), "+40721111111");
  assert.equal(normalisePhone("(0721) 111-111"), "0721111111");
});

test("the same person is found however they typed their number", () => {
  const stored = phoneTail("+40721111111");
  assert.equal(phoneTail("0721111111"), stored);
  assert.equal(phoneTail("0721 111 111"), stored);
  assert.equal(phoneTail("+40 721 111 111"), stored);
  assert.notEqual(phoneTail("+40722222222"), stored);
});
