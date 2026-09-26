/**
 * The Tenuto mark.
 *
 * In a score, a short bar over a note means "tenuto": hold it for its full
 * value. The mark is exactly that — a note head under its bar — printed the
 * way a riso prints: two ink plates, pink and federal blue, a hair out of
 * register, multiplying to violet where they overlap. On hover the plates
 * drift, as if the paper went through the drum again.
 */
export function Mark({ className = "h-8 w-8", onDark = false }: { className?: string; onDark?: boolean }) {
  // On a blue flood the blue plate would vanish, so it prints in paper.
  const blue = onDark ? "var(--color-paper)" : "var(--color-blue)";
  const blend = onDark ? "normal" : "multiply";
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      {/* pink plate: the bar, plus the note head's off-register ghost */}
      <g className="logo-plate logo-plate-pink" style={{ mixBlendMode: blend }}>
        <rect x="6.5" y="5" width="25" height="6.4" rx="1.2" fill="var(--color-pink)" />
        <ellipse cx="21.6" cy="26.4" rx="12.4" ry="8.8" transform="rotate(-24 21.6 26.4)" fill="var(--color-pink)" />
      </g>
      {/* blue plate: the note head, and a sliver of the bar */}
      <g className="logo-plate logo-plate-blue" style={{ mixBlendMode: blend }}>
        <ellipse cx="19.8" cy="25.2" rx="12.4" ry="8.8" transform="rotate(-24 19.8 25.2)" fill={blue} />
        <rect x="8.4" y="6.6" width="25" height="2.2" rx="1.1" fill={blue} opacity="0.9" />
      </g>
    </svg>
  );
}

export function Logo({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={`group inline-flex items-center gap-2 ${className}`}>
      <Mark onDark={onDark} />
      <span
        className={`text-[1.55rem] font-bold leading-none tracking-[-0.055em] ${onDark ? "text-paper" : "text-blue"}`}
      >
        tenuto
      </span>
    </span>
  );
}
