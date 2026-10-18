"use client";

import { useState } from "react";

import { btn } from "./ui";

export function CopyButton({ text, label = "Copiază", className = btn.small }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard blocked (insecure origin, permissions): the text is on
          // screen and selectable, so there is nothing else to do.
        }
      }}
    >
      {copied ? "Copiat ✓" : label}
    </button>
  );
}
