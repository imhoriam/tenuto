/**
 * A generated cover for a venue with no photo, printed in the house inks: a
 * halftone screen in one colour and the venue's initial overprinted in the
 * other. The pairing and the screen angle come from the slug, so each
 * restaurant keeps its own print.
 */
const PRINTS = [
  { bg: "var(--color-blue)", dot: "var(--color-pink)", glyph: "var(--color-pink)" },
  { bg: "var(--color-pink)", dot: "var(--color-blue)", glyph: "var(--color-blue)" },
  { bg: "var(--color-paper)", dot: "var(--color-blue)", glyph: "var(--color-pink)" },
  { bg: "var(--color-blue-soft)", dot: "var(--color-pink)", glyph: "var(--color-blue)" },
];

function hash(slug: string) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function VenueCover({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  const h = hash(slug);
  const p = PRINTS[h % PRINTS.length];
  const angle = [15, 45, 75, -20][(h >> 3) % 4];
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: p.bg }} aria-hidden="true">
      <div
        className="absolute -inset-1/2"
        style={{
          backgroundImage: `radial-gradient(${p.dot} 30%, transparent 32%)`,
          backgroundSize: "10px 10px",
          transform: `rotate(${angle}deg)`,
          maskImage: "radial-gradient(circle at 70% 60%, #000 0%, transparent 62%)",
          opacity: 0.8,
        }}
      />
      <span
        className="absolute -bottom-[0.18em] right-4 text-[8.5rem] font-bold leading-none tracking-[-0.06em]"
        style={{ color: p.glyph, mixBlendMode: "multiply" }}
      >
        {initial}
      </span>
    </div>
  );
}
