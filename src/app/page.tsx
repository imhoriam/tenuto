import Link from "next/link";

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const businesses = await db.business.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true, vertical: true },
  });

  return (
    <main className="min-h-dvh bg-stone-50 text-stone-900">
      <div className="mx-auto w-full max-w-2xl px-4 py-20">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-stone-400">
          Tenuto
        </p>
        <h1 className="mt-3 font-serif text-5xl leading-tight text-stone-900">
          Rezervări care chiar se onorează.
        </h1>
        <p className="mt-4 max-w-lg text-stone-600">
          Clientul rezervă fără cont și fără aplicație. Nu se reține nimic
          — cardul e taxat doar dacă nu ajunge. Clienții fideli nu lasă card
          deloc.
        </p>

        {businesses.length === 0 ? (
          <p className="mt-10 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Nicio locație în baza de date. Rulează{" "}
            <code className="font-mono">npm run db:seed</code>.
          </p>
        ) : (
          <div className="mt-10 space-y-3">
            {businesses.map((b) => (
              <div
                key={b.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-5 py-4"
              >
                <div>
                  <p className="font-medium text-stone-900">{b.name}</p>
                  <p className="text-xs uppercase tracking-wide text-stone-400">
                    {b.vertical}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/book/${b.slug}`}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                  >
                    Rezervă
                  </Link>
                  <Link
                    href={`/dashboard/${b.slug}`}
                    className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:border-stone-400"
                  >
                    Panou restaurant
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-12 text-xs text-stone-400">
          Demo — plăți simulate, nimic real nu se taxează.
        </p>
      </div>
    </main>
  );
}
