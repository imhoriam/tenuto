import type {
  ChargeParams,
  ChargeResult,
  PaymentProvider,
  RefundParams,
  RefundResult,
  SaveCardParams,
  SavedCard,
} from "./provider";

/**
 * In-memory provider for the demo. No network, no keys, works on a laptop with
 * no internet — which matters when you are standing in a restaurant.
 *
 * Card numbers mirror Stripe's test cards so the same inputs keep working once
 * the real provider is wired in:
 *
 *   4242 4242 4242 4242  succeeds
 *   4000 0000 0000 0002  hard decline (card_declined) — no retry
 *   4000 0000 0000 9995  soft decline (insufficient_funds) — retryable
 *   4000 0000 0000 0069  expired_card — no retry
 */

const DECLINE_MAP: Record<string, { code: string; message: string; retryable: boolean }> = {
  "0002": {
    code: "card_declined",
    message: "The card was declined.",
    retryable: false,
  },
  "9995": {
    code: "insufficient_funds",
    message: "The card has insufficient funds.",
    retryable: true,
  },
  "0069": {
    code: "expired_card",
    message: "The card has expired.",
    retryable: false,
  },
};

function brandFor(pan: string): string {
  if (pan.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(pan)) return "mastercard";
  if (/^3[47]/.test(pan)) return "amex";
  return "unknown";
}

function ref(prefix: string): string {
  return `${prefix}_mock_${Math.random().toString(36).slice(2, 12)}`;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async saveCard(params: SaveCardParams): Promise<SavedCard> {
    const pan = params.cardToken.replace(/\D/g, "");
    const last4 = pan.slice(-4) || "4242";

    // A real SetupIntent can fail 3DS. Surface that here so the booking page
    // has to handle it rather than discovering it in production.
    if (last4 === "0069") {
      throw new Error("expired_card: the card has expired.");
    }

    return {
      providerCustomerRef: params.customerRef ?? ref("cus"),
      // The last4 rides along in the ref so a later off-session charge can
      // decide the outcome deterministically. A real provider keeps that
      // association server-side; here the ref is all we get to carry.
      paymentMethodRef: `${ref("pm")}_${last4}`,
      setupIntentRef: ref("seti"),
      cardBrand: brandFor(pan),
      cardLast4: last4,
      cardExpMonth: 12,
      cardExpYear: new Date().getFullYear() + 3,
      threeDSPassed: true,
    };
  }

  async chargeOffSession(params: ChargeParams): Promise<ChargeResult> {
    // saveCard appends the card's last4 to the ref; anything else (a seeded
    // mandate, a hand-written ref) simply succeeds.
    const last4 = params.paymentMethodRef.split("_").at(-1) ?? "";
    const decline = DECLINE_MAP[last4];

    if (decline) {
      return {
        ok: false,
        code: decline.code,
        message: decline.message,
        retryable: decline.retryable,
      };
    }

    if (params.amountCents <= 0) {
      return {
        ok: false,
        code: "amount_too_small",
        message: "Nothing to charge.",
        retryable: false,
      };
    }

    return { ok: true, providerRef: ref("pi") };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    if (!params.chargeRef) {
      return { ok: false, code: "missing_charge", message: "No charge to refund." };
    }
    return { ok: true, refundRef: ref("re") };
  }
}

export const mockProvider = new MockPaymentProvider();
