/**
 * Allowed values for the String status columns in schema.prisma.
 *
 * These live here rather than as Prisma enums because SQLite does not support
 * enums. Keeping them as const objects (plus derived union types) gives the
 * same compile-time safety and survives the move to Postgres unchanged.
 */

export const VERTICAL = {
  RESTAURANT: "restaurant",
  DETAILING: "detailing",
  CLINIC: "clinic",
  STUDIO: "studio",
} as const;
export type Vertical = (typeof VERTICAL)[keyof typeof VERTICAL];

export const SUBSCRIPTION_STATUS = {
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
} as const;
export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const RESOURCE_KIND = {
  TABLE: "table",
  BAY: "bay",
  CHAIR: "chair",
  PRACTITIONER: "practitioner",
  ROOM: "room",
} as const;
export type ResourceKind = (typeof RESOURCE_KIND)[keyof typeof RESOURCE_KIND];

/**
 * What a given customer must do to hold this slot. Resolved at booking time by
 * the policy engine and frozen onto the Booking row.
 */
export const REQUIREMENT = {
  /** Trusted regular. No card, no friction. */
  NONE: "none",
  /** Card saved via SetupIntent. Nothing is charged unless they no-show. */
  CARD_ON_FILE: "card_on_file",
  /** Money captured up front, credited against the bill on arrival. */
  DEPOSIT: "deposit",
} as const;
export type Requirement = (typeof REQUIREMENT)[keyof typeof REQUIREMENT];

export const BOOKING_STATUS = {
  /** Slot held, payment setup not finished. Expires quickly. */
  DRAFT: "draft",
  PENDING_SETUP: "pending_setup",
  /** Live booking. */
  CONFIRMED: "confirmed",
  /** Cancelled inside the policy window — nothing owed. */
  CANCELLED_FREE: "cancelled_free",
  /** Cancelled too late — chargeable. */
  CANCELLED_LATE: "cancelled_late",
  /** Customer is here. Terminal for money purposes: nothing can be charged. */
  CHECKED_IN: "checked_in",
  COMPLETED: "completed",
  /** Marked absent; grace window running before the charge fires. */
  NO_SHOW_PENDING: "no_show_pending",
  CHARGE_SUCCEEDED: "charge_succeeded",
  CHARGE_FAILED: "charge_failed",
  /** Business or platform forgave it. */
  WAIVED: "waived",
  DISPUTED: "disputed",
  EXPIRED: "expired",
} as const;
export type BookingStatus =
  (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

export const MANDATE_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  FAILED: "failed",
  REVOKED: "revoked",
} as const;
export type MandateStatus =
  (typeof MANDATE_STATUS)[keyof typeof MANDATE_STATUS];

export const CHARGE_STATUS = {
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  /** Retries exhausted. Business is told; we stop trying. */
  UNCOLLECTIBLE: "uncollectible",
  REFUNDED: "refunded",
  DISPUTED: "disputed",
} as const;
export type ChargeStatus = (typeof CHARGE_STATUS)[keyof typeof CHARGE_STATUS];

export const CHECKIN_METHOD = {
  /** Customer scanned the printed code at the venue. Strongest evidence. */
  QR: "qr",
  /** Customer tapped the link in their reminder, location-validated. */
  LINK: "link",
  /** Staff vouched for them. May only prevent a charge, never cause one. */
  MANUAL: "manual",
} as const;
export type CheckInMethod =
  (typeof CHECKIN_METHOD)[keyof typeof CHECKIN_METHOD];

export const ACTOR = {
  CUSTOMER: "customer",
  BUSINESS: "business",
  SYSTEM: "system",
} as const;
export type Actor = (typeof ACTOR)[keyof typeof ACTOR];

export const CHANNEL = {
  /** Demo default: writes to the DB and the server log, sends nothing. */
  CONSOLE: "console",
  SMS: "sms",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
} as const;
export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];

/** Statuses from which no further money movement is possible. */
export const MONEY_SAFE_STATUSES: readonly BookingStatus[] = [
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CANCELLED_FREE,
  BOOKING_STATUS.WAIVED,
  BOOKING_STATUS.EXPIRED,
];

/** Statuses that count as the booking being over, for availability purposes. */
export const RELEASED_STATUSES: readonly BookingStatus[] = [
  BOOKING_STATUS.CANCELLED_FREE,
  BOOKING_STATUS.CANCELLED_LATE,
  BOOKING_STATUS.NO_SHOW_PENDING,
  BOOKING_STATUS.CHARGE_SUCCEEDED,
  BOOKING_STATUS.CHARGE_FAILED,
  BOOKING_STATUS.WAIVED,
  BOOKING_STATUS.EXPIRED,
  BOOKING_STATUS.COMPLETED,
];

/** Statuses that still occupy their slot and block other bookings. */
export const BLOCKING_STATUSES: readonly BookingStatus[] = [
  BOOKING_STATUS.DRAFT,
  BOOKING_STATUS.PENDING_SETUP,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
  BOOKING_STATUS.DISPUTED,
];
