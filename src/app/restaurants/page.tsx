import { TZDate } from "@date-fns/tz";
import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { btn, label } from "@/components/ui";
import { VenueCover } from "@/components/venue-cover";
import { PRICE_LEVELS, describeDay, fold, openStatus } from "@/lib/business-profile";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Caută unde rezervi",
  description: "Rezervă la restaurante, saloane, clinici și alte afaceri — fără cont și fără aplicație.",
};

export const dynamic = "force-dynamic";

export default async function RestaurantsPage({ searchParams }: PageProps<"/restaurants">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const city = typeof sp.city === "string" ? sp.city : "";

  // Loaded whole and filtered in memory: SQLite's LIKE is case-sensitive
  // outside ASCII and knows nothing of diacritics. Move to a DB-side search
  // (Postgres unaccent + trigram) once the list stops being small.
  const venues = await db.business.findMany({
    where: { published: true, suspendedAt: null },
    include: {
      locations: { take: 1 },
      scheduleRules: { where: { resourceId: null } },
    },
    orderBy: { name: "asc" },
  });

  const cities = [...new Set(venues.map((v) => v.locations[0]?.city).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, "ro"),
  );

  const needle = fold(q);
  const results = venues.filter((v) => {
    const loc = v.locations[0];
    if (city && fold(loc?.city ?? "") !== fold(city)) return false;
    if (!needle) return true;
    return [v.name, v.category ?? "", v.description ?? "", loc?.city ?? "", loc?.address ?? ""].some((s) =>
      fold(s).includes(needle),
    );
  });

  const now = new Date().getTime();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b-2 border-blue">
          <div aria-hidden="true" className="halftone-pink halftone-fade pointer-events-none absolute -right-20 top-0 h-80 w-[40rem] opacity-50" />
          <div className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-14 sm:px-6">
            <p className={`${label} text-pink-deep`}>Caută</p>
            <h1 className="mt-3 text-5xl font-bold leading-[0.9] tracking-[-0.055em] text-blue sm:text-7xl">
              Unde rezervi{" "}
              <span className="overprint" data-text="azi?">
                azi?
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink">Rezervi fără cont. Nu plătești nimic ca să rezervi.</p>

            <form
              action="/restaurants"
              className="mt-9 flex flex-col gap-2 rounded-lg border-2 border-blue bg-sheet p-2 shadow-[var(--shadow-print-lg)] sm:flex-row"
            >
              <label className="flex flex-1 items-center gap-3 rounded-md px-3">
                <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-blue" aria-hidden="true">
                  <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
                  <path d="M13 13l5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
                </svg>
                <span className="sr-only">Caută</span>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Nume, categorie, zonă…"
                  className="w-full bg-transparent py-3 text-lg text-ink outline-none placeholder:text-faint"
                />
              </label>
              <label className="flex items-center rounded-md border-2 border-blue/25 px-3 sm:w-56">
                <span className="sr-only">Oraș</span>
                <select name="city" defaultValue={city} className="w-full bg-transparent py-3 font-semibold text-blue outline-none">
                  <option value="">Toate orașele</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={`${btn.primary} sm:px-8`}>
                Caută
              </button>
            </form>

            {cities.length > 1 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {cities.map((c) => {
                  const on = fold(c) === fold(city);
                  return (
                    <Link
                      key={c}
                      href={on ? `/restaurants${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/restaurants?city=${encodeURIComponent(c)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                      aria-pressed={on}
                      className={`rounded-md border-2 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.12em] transition ${
                        on ? "border-blue bg-blue text-paper" : "border-blue/30 bg-sheet text-blue hover:border-blue"
                      }`}
                    >
                      {c}
                      {on ? " ✕" : ""}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <p className={`${label} text-blue`}>
            {results.length === 0
              ? "Niciun loc găsit"
              : `${results.length} ${results.length === 1 ? "loc" : "locuri"}${city ? ` în ${city}` : ""}`}
            {q || city ? (
              <>
                {" · "}
                <Link href="/restaurants" className="underline decoration-pink decoration-2 underline-offset-4">
                  resetează
                </Link>
              </>
            ) : null}
          </p>

          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((v) => {
              const loc = v.locations[0];
              const local = new TZDate(now, v.timezone);
              const status = openStatus(v.scheduleRules, {
                weekday: local.getDay(),
                minute: local.getHours() * 60 + local.getMinutes(),
              });
              const price = PRICE_LEVELS.find((p) => p.value === v.priceLevel);

              return (
                <li key={v.id}>
                  <Link href={`/book/${v.slug}`} className="press group flex h-full flex-col overflow-hidden rounded-lg border-2 border-blue bg-sheet">
                    <div className="relative">
                      <VenueCover slug={v.slug} name={v.name} className="h-40 border-b-2 border-blue" />
                      <span
                        className={`absolute left-3 top-3 rounded-md border-2 border-blue px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${
                          status.open ? "bg-sheet text-blue" : "bg-blue text-paper"
                        }`}
                      >
                        {status.open ? "● Deschis" : "Închis"}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="text-xl font-bold leading-tight tracking-tight text-blue">{v.name}</h2>
                      <p className={`${label} mt-2 text-muted`}>
                        {[v.category, loc?.city, price?.label].filter(Boolean).join(" · ")}
                      </p>
                      {v.description ? (
                        <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-ink">{v.description}</p>
                      ) : null}
                      <div className="mt-auto flex items-center justify-between border-t-2 border-dashed border-blue/25 pt-4 text-sm">
                        <span className="font-mono text-xs text-muted">Azi {describeDay(status.today)}</span>
                        <span className="font-bold text-blue">
                          Rezervă <span className="inline-block transition group-hover:translate-x-1">→</span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {results.length === 0 ? (
            <div className="mt-6 rounded-lg border-2 border-dashed border-blue p-12 text-center">
              <p className="text-3xl font-bold tracking-tight text-blue">Nimic aici încă.</p>
              <p className="mt-2 text-ink">Încearcă alt nume sau alt oraș. Ai o afacere?</p>
              <Link href="/register" className={`${btn.primary} mt-6`}>
                Înregistrează-l
              </Link>
            </div>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
