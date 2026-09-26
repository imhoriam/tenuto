/**
 * SMS text. Pure — no provider, no database — so it tests on its own.
 *
 * Romanian diacritics (ă â î ș ț) are not in the GSM-7 alphabet. A single one
 * switches the whole message to UCS-2, which cuts a segment from 160 to 70
 * characters and roughly doubles the cost. Transactional SMS in Romania are
 * conventionally sent without them, so we fold them out.
 */

const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";

/** "Ședință în Brașov – 20:00" → "Sedinta in Brasov - 20:00". */
export function toGsm(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[„“”]/g, '"')
    .replace(/[‚‘’]/g, "'")
    .replace(/…/g, "...")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\n\r\x20-\x7E£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà€]/g, "");
}

export function isGsm7(text: string): boolean {
  return [...text].every((ch) => GSM7.includes(ch) || GSM7_EXT.includes(ch));
}

/** How many billable segments a message takes. */
export function segments(text: string): number {
  if (isGsm7(text)) {
    const units = [...text].reduce((n, ch) => n + (GSM7_EXT.includes(ch) ? 2 : 1), 0);
    return units <= 160 ? 1 : Math.ceil(units / 153);
  }
  const len = [...text].length;
  return len <= 70 ? 1 : Math.ceil(len / 67);
}

/**
 * Romanian numbers as typed → E.164, which every SMS provider wants.
 * 0721 111 111, +40 721-111-111 and 0040721111111 all become +40721111111.
 * Returns null for something that is not a plausible number.
 */
export function toE164(input: string, defaultCountry = "40"): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = defaultCountry + digits.slice(1);
  } else if (digits.length === 9) {
    digits = defaultCountry + digits;
  }
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
}

export interface ConfirmationSmsInput {
  businessName: string;
  /** Already formatted in the business's timezone, e.g. "sam. 3 oct, 20:00". */
  when: string;
  partySize: number;
  address: string | null;
  gracePeriodMin: number;
  url: string;
}

/**
 * The confirmation. Everything the customer needs to turn up — where, when,
 * how long the table is held — and the link to their booking page, where the
 * QR code for the host lives. Kept to two segments at most.
 */
export function confirmationSms(i: ConfirmationSmsInput): string {
  const lines = [
    `Rezervare confirmata: ${i.businessName}, ${i.when}, ${i.partySize} pers.`,
    i.address ? `Adresa: ${i.address}.` : null,
    `Masa e tinuta ${i.gracePeriodMin} min.`,
    `La sosire arata codul QR: ${i.url}`,
  ].filter(Boolean);
  return toGsm(lines.join("\n"));
}
