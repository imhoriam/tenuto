import { test } from "node:test";
import assert from "node:assert/strict";

import { REQUIREMENT } from "@/lib/constants";
import {
  type PolicyContext,
  type PolicyRuleShape,
  resolveRequirement,
} from "./policy";

const DEFAULTS = { noShowFeeCents: 5000 };

const rule = (over: Partial<PolicyRuleShape>): PolicyRuleShape => ({
  id: over.id ?? "r",
  name: over.name ?? "rule",
  priority: over.priority ?? 100,
  enabled: over.enabled ?? true,
  minCompletedHere: over.minCompletedHere ?? null,
  hasNoShowHistory: over.hasNoShowHistory ?? null,
  minPartySize: over.minPartySize ?? null,
  minServicePriceCents: over.minServicePriceCents ?? null,
  appliesOnWeekend: over.appliesOnWeekend ?? null,
  requirement: over.requirement ?? REQUIREMENT.CARD_ON_FILE,
  feeCentsOverride: over.feeCentsOverride ?? null,
});

const ctx = (over: Partial<PolicyContext> = {}): PolicyContext => ({
  completedHere: 0,
  hasNoShowHistory: false,
  partySize: 2,
  servicePriceCents: 0,
  weekday: 3, // Wednesday
  ...over,
});

const SEEDED: PolicyRuleShape[] = [
  rule({
    id: "a",
    name: "Regulars book free",
    priority: 10,
    minCompletedHere: 3,
    requirement: REQUIREMENT.NONE,
  }),
  rule({
    id: "b",
    name: "Previous no-show pays a deposit",
    priority: 20,
    hasNoShowHistory: true,
    requirement: REQUIREMENT.DEPOSIT,
    feeCentsOverride: 10000,
  }),
  rule({
    id: "c",
    name: "Large parties leave a card",
    priority: 30,
    minPartySize: 6,
    requirement: REQUIREMENT.CARD_ON_FILE,
    feeCentsOverride: 15000,
  }),
  rule({ id: "d", name: "Everyone else leaves a card", priority: 100 }),
];

test("a regular books with no card and no fee", () => {
  const out = resolveRequirement(SEEDED, ctx({ completedHere: 5 }), DEFAULTS);
  assert.equal(out.requirement, REQUIREMENT.NONE);
  assert.equal(out.feeCents, 0);
  assert.equal(out.matchedRuleName, "Regulars book free");
});

test("a first-timer leaves a card at the default fee", () => {
  const out = resolveRequirement(SEEDED, ctx(), DEFAULTS);
  assert.equal(out.requirement, REQUIREMENT.CARD_ON_FILE);
  assert.equal(out.feeCents, 5000);
});

test("a prior no-show outranks the large-party rule", () => {
  // Priority 20 beats 30 — the riskier signal wins.
  const out = resolveRequirement(
    SEEDED,
    ctx({ hasNoShowHistory: true, partySize: 8 }),
    DEFAULTS,
  );
  assert.equal(out.requirement, REQUIREMENT.DEPOSIT);
  assert.equal(out.feeCents, 10000);
});

test("being a regular outranks having burned someone else", () => {
  // Priority 10 beats 20: this business's own experience wins.
  const out = resolveRequirement(
    SEEDED,
    ctx({ completedHere: 4, hasNoShowHistory: true }),
    DEFAULTS,
  );
  assert.equal(out.requirement, REQUIREMENT.NONE);
  assert.equal(out.feeCents, 0);
});

test("a large party pays the bigger fee", () => {
  const out = resolveRequirement(SEEDED, ctx({ partySize: 6 }), DEFAULTS);
  assert.equal(out.feeCents, 15000);
  assert.equal(out.matchedRuleName, "Large parties leave a card");
});

test("a requirement of none can never carry a fee", () => {
  // Even if someone sets an override on a "no card" rule by mistake.
  const out = resolveRequirement(
    [rule({ requirement: REQUIREMENT.NONE, feeCentsOverride: 9999 })],
    ctx(),
    DEFAULTS,
  );
  assert.equal(out.feeCents, 0);
});

test("disabled rules are ignored", () => {
  const out = resolveRequirement(
    [
      rule({ id: "x", priority: 1, requirement: REQUIREMENT.NONE, enabled: false }),
      rule({ id: "y", priority: 2 }),
    ],
    ctx(),
    DEFAULTS,
  );
  assert.equal(out.requirement, REQUIREMENT.CARD_ON_FILE);
});

test("no matching rule fails closed, not open", () => {
  const out = resolveRequirement(
    [rule({ minPartySize: 99 })],
    ctx({ partySize: 2 }),
    DEFAULTS,
  );
  assert.equal(out.requirement, REQUIREMENT.CARD_ON_FILE);
  assert.equal(out.feeCents, 5000);
  assert.equal(out.matchedRuleId, null);
});

test("a weekend-only rule does not fire midweek", () => {
  const weekendOnly = [
    rule({ id: "w", priority: 5, appliesOnWeekend: true, requirement: REQUIREMENT.DEPOSIT }),
    rule({ id: "z", priority: 50 }),
  ];
  assert.equal(
    resolveRequirement(weekendOnly, ctx({ weekday: 3 }), DEFAULTS).requirement,
    REQUIREMENT.CARD_ON_FILE,
  );
  assert.equal(
    resolveRequirement(weekendOnly, ctx({ weekday: 6 }), DEFAULTS).requirement,
    REQUIREMENT.DEPOSIT,
  );
});
