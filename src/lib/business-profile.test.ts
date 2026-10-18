import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORIES,
  VERTICALS,
  defaultResourceName,
  describeDay,
  hoursToRules,
  isValidCui,
  isValidTradeRegisterNo,
  missingForPublish,
  normaliseCui,
  rulesToHours,
  slugify,
  verticalOf,
} from "./business-profile";

test("a real CUI validates, with or without the RO prefix and spacing", () => {
  // Dante International (eMAG), a public fiscal code.
  assert.equal(isValidCui("14399840"), true);
  assert.equal(isValidCui("RO14399840"), true);
  assert.equal(isValidCui("ro 1439 9840"), true);
});

test("a CUI with the wrong check digit is refused", () => {
  assert.equal(isValidCui("14399841"), false);
  assert.equal(isValidCui("14399849"), false);
});

test("a CUI that is empty, too short or too long is refused", () => {
  assert.equal(isValidCui(""), false);
  assert.equal(isValidCui("1"), false);
  assert.equal(isValidCui("12345678901"), false);
});

test("normalising strips the VAT prefix and non-digits", () => {
  assert.equal(normaliseCui(" RO 14.399.840 "), "14399840");
});

test("both trade register formats are accepted", () => {
  assert.equal(isValidTradeRegisterNo("J40/1234/2020"), true);
  assert.equal(isValidTradeRegisterNo("j40 / 1234 / 2020"), true);
  assert.equal(isValidTradeRegisterNo("J2020001234409"), true);
  assert.equal(isValidTradeRegisterNo("40/1234/2020"), false);
  assert.equal(isValidTradeRegisterNo("J40-1234-2020"), false);
});

test("hours become schedule rules in local minutes", () => {
  const res = hoursToRules({ 2: [{ open: "12:00", close: "15:00" }, { open: "18:00", close: "23:00" }] });
  assert.ok(res.ok);
  assert.deepEqual(res.rules, [
    { weekday: 2, startMinute: 720, endMinute: 900 },
    { weekday: 2, startMinute: 1080, endMinute: 1380 },
  ]);
});

test("a close before the open runs past midnight (endMinute > 1440)", () => {
  const res = hoursToRules({ 5: [{ open: "18:00", close: "01:00" }] });
  assert.ok(res.ok);
  assert.deepEqual(res.rules, [{ weekday: 5, startMinute: 1080, endMinute: 1500 }]);
});

test("overlapping intervals on one day are refused", () => {
  const res = hoursToRules({ 3: [{ open: "12:00", close: "16:00" }, { open: "15:00", close: "22:00" }] });
  assert.equal(res.ok, false);
});

test("a malformed time is refused", () => {
  assert.equal(hoursToRules({ 1: [{ open: "25:00", close: "23:00" }] }).ok, false);
  assert.equal(hoursToRules({ 1: [{ open: "noon", close: "23:00" }] }).ok, false);
});

test("rules round-trip back to hours, including past midnight", () => {
  const hours = rulesToHours([
    { weekday: 5, startMinute: 1080, endMinute: 1500 },
    { weekday: 2, startMinute: 720, endMinute: 900 },
  ]);
  assert.deepEqual(hours[5], [{ open: "18:00", close: "01:00" }]);
  assert.deepEqual(hours[2], [{ open: "12:00", close: "15:00" }]);
  assert.deepEqual(hours[1], []);
  assert.equal(describeDay(hours[1]), "Închis");
  assert.equal(describeDay(hours[5]), "18:00–01:00");
});

test("slugs drop diacritics and punctuation", () => {
  assert.equal(slugify("Hanul cu Tei — Centru"), "hanul-cu-tei-centru");
  assert.equal(slugify("Ștrand & Țuică!"), "strand-tuica");
  assert.equal(slugify("!!!"), "restaurant");
});

test("a restaurant is publishable only once it can actually take a booking", () => {
  const complete = {
    name: "X",
    category: "Bistro",
    phone: "0721000000",
    address: "Str. A 1",
    city: "Cluj-Napoca",
    legalName: "X SRL",
    taxId: "14399840",
    tradeRegisterNo: "J12/1/2020",
    registeredAddress: "Str. A 1",
    activeTables: 3,
    scheduleRules: 6,
  };
  assert.deepEqual(missingForPublish(complete), []);
  assert.deepEqual(missingForPublish({ ...complete, activeTables: 0 }), ["Cel puțin o masă"]);
  assert.deepEqual(missingForPublish({ ...complete, taxId: null }), ["Datele firmei"]);
  assert.deepEqual(missingForPublish({ ...complete, category: "Frizerie", activeTables: 0 }), ["Cel puțin un post"]);
  assert.deepEqual(missingForPublish({ ...complete, category: "Detailing auto", activeTables: 0 }), ["Cel puțin o boxă"]);
});

test("a category maps to its vertical; a typed one is 'other'; none yet is a restaurant", () => {
  assert.equal(verticalOf("Bistro"), "restaurant");
  assert.equal(verticalOf("Frizerie"), "beauty");
  assert.equal(verticalOf("Cabinet stomatologic"), "health");
  assert.equal(verticalOf("Detailing auto"), "auto");
  assert.equal(verticalOf("Școală de înot"), "other");
  assert.equal(verticalOf(null), "restaurant");
  assert.equal(verticalOf(""), "restaurant");
});

test("only restaurants book by party size", () => {
  for (const [key, v] of Object.entries(VERTICALS)) {
    assert.equal(v.usesPartySize, key === "restaurant", key);
  }
});

test("no category is listed under two verticals", () => {
  assert.equal(new Set(CATEGORIES).size, CATEGORIES.length);
});

test("default resource names follow the vertical", () => {
  assert.equal(defaultResourceName("restaurant", 3), "M3");
  assert.equal(defaultResourceName("auto", 1), "Boxă 1");
  assert.equal(defaultResourceName("health", 2), "Specialist 2");
  assert.equal(defaultResourceName("sport", 1), "Teren 1");
});

test("open now respects today's intervals", async () => {
  const { openStatus } = await import("./business-profile");
  const rules = [{ weekday: 2, startMinute: 720, endMinute: 1380 }];
  assert.equal(openStatus(rules, { weekday: 2, minute: 800 }).open, true);
  assert.equal(openStatus(rules, { weekday: 2, minute: 1380 }).open, false);
  assert.deepEqual(openStatus(rules, { weekday: 2, minute: 0 }).today, [{ open: "12:00", close: "23:00" }]);
});

test("a Friday that runs to 01:00 is still open at 00:30 on Saturday", async () => {
  const { openStatus } = await import("./business-profile");
  const rules = [{ weekday: 5, startMinute: 1080, endMinute: 1500 }];
  assert.equal(openStatus(rules, { weekday: 6, minute: 30 }).open, true);
  assert.equal(openStatus(rules, { weekday: 6, minute: 70 }).open, false);
});

test("folding makes search diacritic-insensitive", async () => {
  const { fold } = await import("./business-profile");
  assert.equal(fold("Brașov"), fold("brasov"));
  assert.equal(fold("  Târgu Mureș "), "targu mures");
});
