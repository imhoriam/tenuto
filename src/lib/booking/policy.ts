import { REQUIREMENT, type Requirement } from "@/lib/constants";

/**
 * Risk-based enforcement.
 *
 * This is the feature that answers the objection every operator raises: "I
 * don't want to scare my regulars away." Rules are evaluated in ascending
 * priority and the first match wins, so a business can let regulars book with
 * no card while still protecting the Saturday six-top.
 */

export interface PolicyRuleShape {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  minCompletedHere: number | null;
  hasNoShowHistory: boolean | null;
  minPartySize: number | null;
  minServicePriceCents: number | null;
  appliesOnWeekend: boolean | null;
  requirement: string;
  feeCentsOverride: number | null;
}

export interface PolicyContext {
  /** Completed bookings this customer has with *this* business. */
  completedHere: number;
  /** A no-show anywhere on the platform, not just here. */
  hasNoShowHistory: boolean;
  partySize: number;
  servicePriceCents: number;
  /** Local weekday at the business, 0 = Sunday. */
  weekday: number;
}

export interface PolicyOutcome {
  requirement: Requirement;
  feeCents: number;
  /** Which rule decided this, for the dashboard and for disputes. */
  matchedRuleId: string | null;
  matchedRuleName: string;
}

function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 5 || weekday === 6;
}

function matches(rule: PolicyRuleShape, ctx: PolicyContext): boolean {
  if (
    rule.minCompletedHere !== null &&
    ctx.completedHere < rule.minCompletedHere
  ) {
    return false;
  }
  if (
    rule.hasNoShowHistory !== null &&
    ctx.hasNoShowHistory !== rule.hasNoShowHistory
  ) {
    return false;
  }
  if (rule.minPartySize !== null && ctx.partySize < rule.minPartySize) {
    return false;
  }
  if (
    rule.minServicePriceCents !== null &&
    ctx.servicePriceCents < rule.minServicePriceCents
  ) {
    return false;
  }
  if (
    rule.appliesOnWeekend !== null &&
    isWeekend(ctx.weekday) !== rule.appliesOnWeekend
  ) {
    return false;
  }
  return true;
}

export function resolveRequirement(
  rules: PolicyRuleShape[],
  ctx: PolicyContext,
  defaults: { noShowFeeCents: number },
): PolicyOutcome {
  const ordered = rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  for (const rule of ordered) {
    if (!matches(rule, ctx)) continue;

    const requirement = rule.requirement as Requirement;
    return {
      requirement,
      // A rule that asks for nothing can never carry a fee.
      feeCents:
        requirement === REQUIREMENT.NONE
          ? 0
          : (rule.feeCentsOverride ?? defaults.noShowFeeCents),
      matchedRuleId: rule.id,
      matchedRuleName: rule.name,
    };
  }

  // No rule matched. Fail closed — ask for a card rather than silently
  // dropping protection the business thinks it has.
  return {
    requirement: REQUIREMENT.CARD_ON_FILE,
    feeCents: defaults.noShowFeeCents,
    matchedRuleId: null,
    matchedRuleName: "Default (no rule matched)",
  };
}
