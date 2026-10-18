import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_UPDATED } from "@/lib/legal";
import { LEGAL_DOCS, findDoc } from "../content";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  const found = findDoc(doc);
  return found ? { title: found.title, description: found.summary } : {};
}

export default async function LegalDocPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  const found = findDoc(doc);
  if (!found) notFound();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[14rem_1fr]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Documente</p>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible">
            {LEGAL_DOCS.map((d) => (
              <Link
                key={d.slug}
                href={`/legal/${d.slug}`}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm transition ${
                  d.slug === found.slug ? "bg-blue text-paper" : "text-blue hover:bg-blue-soft"
                }`}
              >
                {d.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pink-deep">Legal</p>
          <h1 className="mt-3 text-5xl font-bold leading-[0.95] tracking-[-0.05em] text-blue sm:text-6xl">{found.title}</h1>
          <p className="mt-4 text-lg text-muted">{found.summary}</p>
          <p className="mt-2 text-sm text-faint">Ultima actualizare: {LEGAL_UPDATED}</p>

          <div className="mt-12 space-y-10">
            {found.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-lg font-semibold tracking-tight text-ink">{s.heading}</h2>
                <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted">
                  {s.body.map((b, i) =>
                    typeof b === "string" ? (
                      <p key={i}>{b}</p>
                    ) : (
                      <ul key={i} className="space-y-2 pl-1">
                        {b.list.map((li) => (
                          <li key={li} className="flex gap-3">
                            <span className="mt-2 h-2 w-2 shrink-0 bg-pink" />
                            <span>{li}</span>
                          </li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
