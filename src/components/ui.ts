/**
 * Shared class strings. Plain strings rather than components so they compose
 * with <Link>, <button> and <a> alike.
 *
 * Pink is the only interaction colour: every primary action is a pink block
 * with a blue print-shadow that presses in. Secondary actions are outlined in
 * blue on paper. Text on pink is always ink — pink with white text fails AA.
 */

const base =
  "press inline-flex items-center justify-center gap-2 rounded-md border-2 border-blue px-5 py-2.5 text-[15px] font-semibold tracking-tight disabled:cursor-not-allowed disabled:opacity-40";

export const btn = {
  primary: `${base} bg-pink text-ink hover:bg-[#f54fae]`,
  accent: `${base} bg-pink text-ink hover:bg-[#f54fae]`,
  ghost: `${base} bg-sheet text-blue hover:bg-white`,
  small:
    "press inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-blue bg-sheet px-3 py-1.5 text-sm font-semibold text-blue disabled:cursor-not-allowed disabled:opacity-40",
};

export const field = {
  label: "mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-blue",
  hint: "mt-1.5 text-xs text-muted",
  input:
    "w-full rounded-md border-2 border-blue/30 bg-sheet px-3.5 py-2.5 text-ink outline-none transition placeholder:text-faint hover:border-blue/50 focus:border-blue focus:shadow-[3px_3px_0_var(--color-pink)]",
  error: "mt-1.5 text-xs text-red-700",
};

/** A printed card: sheet paper, blue rule, no shadow unless it earns one. */
export const card = "rounded-lg border-2 border-blue bg-sheet";

/** Mono caps label, the riso equivalent of an eyebrow. */
export const label = "font-mono text-[11px] font-semibold uppercase tracking-[0.18em]";
