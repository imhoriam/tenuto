/**
 * Who operates the platform, as shown in the footer and the legal pages.
 *
 * TODO before launch: replace with the real operating company. Romanian law
 * (and ANPC) requires the operator's identification on every consumer-facing
 * page, and the legal pages under /legal are drafts that need review by a
 * lawyer — they describe how the product actually behaves, which is the part
 * a lawyer cannot write, but they are not legal advice.
 */
export const OPERATOR = {
  legalName: "Tenuto S.R.L.",
  taxId: "[de completat]",
  tradeRegisterNo: "[de completat]",
  address: "[sediu social — de completat]",
  email: "contact@tenuto.ro",
  privacyEmail: "gdpr@tenuto.ro",
} as const;

export const LEGAL_UPDATED = "26 septembrie 2026";
