/**
 * Payment provider boundary.
 *
 * The demo runs on `mock`. Stripe slots in behind this same interface, so
 * nothing above it changes. The shape deliberately mirrors the Stripe flow we
 * will actually use:
 *
 *   saveCard()     -> SetupIntent with 3DS, flagged for future merchant-
 *                     initiated transactions. No money moves.
 *   chargeOffSession() -> PaymentIntent with off_session, only on a no-show.
 *
 * That ordering is the product decision: for the ~85-90% of customers who turn
 * up, no money ever moves, so there is no refund latency and no processing fee.
 */

export interface SaveCardParams {
  customerRef: string | null;
  customerName: string;
  customerPhone: string;
  /** Presentational only — the provider never returns a full PAN. */
  cardToken: string;
}

export interface SavedCard {
  providerCustomerRef: string;
  paymentMethodRef: string;
  setupIntentRef: string;
  cardBrand: string;
  cardLast4: string;
  cardExpMonth: number;
  cardExpYear: number;
  threeDSPassed: boolean;
}

export interface ChargeParams {
  paymentMethodRef: string;
  providerCustomerRef: string;
  amountCents: number;
  currency: string;
  /** Must be stable per logical charge. The DB also enforces uniqueness. */
  idempotencyKey: string;
  description: string;
  /** Connected account that receives the money, minus our application fee. */
  destinationAccountRef: string | null;
  applicationFeeCents?: number;
}

export type ChargeResult =
  | { ok: true; providerRef: string }
  | {
      ok: false;
      /** Stripe-style decline code, e.g. card_declined, insufficient_funds. */
      code: string;
      message: string;
      /** False for a hard decline — retrying will not help. */
      retryable: boolean;
    };

export interface PaymentProvider {
  readonly name: string;
  saveCard(params: SaveCardParams): Promise<SavedCard>;
  chargeOffSession(params: ChargeParams): Promise<ChargeResult>;
}

/**
 * Retry ladder for a soft decline. Deliberately short: chasing a EUR 50
 * no-show fee for a fortnight costs more in support than it collects.
 */
export const RETRY_DELAYS_MS = [24 * 60 * 60 * 1000, 72 * 60 * 60 * 1000];

export function nextRetryAt(attempt: number, from: Date = new Date()): Date | null {
  const delay = RETRY_DELAYS_MS[attempt - 1];
  return delay === undefined ? null : new Date(from.getTime() + delay);
}
