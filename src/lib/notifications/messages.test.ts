import { test } from "node:test";
import assert from "node:assert/strict";

import { confirmationSms, isGsm7, segments, toE164, toGsm } from "./messages";

test("diacritics are folded so the SMS stays in GSM-7", () => {
  assert.equal(toGsm("Ședință în Brașov – ținută"), "Sedinta in Brasov - tinuta");
  assert.equal(isGsm7("Sedinta in Brasov"), true);
  assert.equal(isGsm7("Ședință"), false);
});

test("one diacritic would cost a segment: 160 vs 70 characters", () => {
  assert.equal(segments("a".repeat(160)), 1);
  assert.equal(segments("a".repeat(161)), 2);
  assert.equal(segments("ș" + "a".repeat(69)), 1);
  assert.equal(segments("ș" + "a".repeat(70)), 2);
});

test("Romanian numbers become E.164 however they are typed", () => {
  for (const typed of ["0721 111 111", "0721-111-111", "+40 721 111 111", "0040721111111", "721111111"]) {
    assert.equal(toE164(typed), "+40721111111", typed);
  }
  assert.equal(toE164("+44 20 7946 0958"), "+442079460958");
  assert.equal(toE164("123"), null);
});

test("the confirmation carries where, when, the hold and the link — in two segments", () => {
  const sms = confirmationSms({
    businessName: "Hanul cu Tei",
    when: "sâm. 3 oct., 20:00",
    partySize: 4,
    address: "Strada Lipscani 12, București",
    gracePeriodMin: 15,
    url: "https://tenuto.ro/r/9qQwPREU_Je1nzg4TgTpvU-Q",
  });
  assert.match(sms, /Hanul cu Tei/);
  assert.match(sms, /20:00/);
  assert.match(sms, /Strada Lipscani 12, Bucuresti/);
  assert.match(sms, /15 min/);
  assert.match(sms, /https:\/\/tenuto\.ro\/r\/9qQwPREU_Je1nzg4TgTpvU-Q/);
  assert.equal(isGsm7(sms), true, "no diacritics may slip through");
  assert.ok(segments(sms) <= 2, `too long: ${segments(sms)} segments`);
});

test("without a party size the SMS drops 'pers.' and holds the place, not a table", () => {
  const sms = confirmationSms({
    businessName: "Detailing Nord",
    when: "sâm. 3 oct., 10:00",
    partySize: null,
    address: null,
    gracePeriodMin: 15,
    url: "https://tenuto.ro/r/x",
  });
  assert.doesNotMatch(sms, /pers\./);
  assert.doesNotMatch(sms, /Masa/);
  assert.match(sms, /Locul e tinut 15 min/);
});
