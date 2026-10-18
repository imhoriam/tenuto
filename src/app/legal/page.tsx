import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_DOCS } from "./content";

export const metadata: Metadata = { title: "Legal" };

export default function LegalIndex() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-deep">Legal</p>
        <h1 className="mt-3 text-5xl font-bold leading-[0.95] tracking-[-0.05em] text-blue sm:text-6xl">Totul scris, în limbaj clar.</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Cum funcționează rezervările, garanțiile și datele dumneavoastră — fără litere mici.
        </p>
        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.slug}
              href={`/legal/${d.slug}`}
              className="press group rounded-lg border-2 border-blue bg-sheet p-7"
            >
              <p className="text-lg font-semibold">{d.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{d.summary}</p>
              <p className="mt-6 text-sm text-pink-deep">Citește →</p>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
