import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { db } from "@/lib/db";
import { checkInUrl } from "@/lib/checkin";

export const dynamic = "force-dynamic";

async function origin(): Promise<string> {
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host") ?? "localhost:3000";
  const proto =
    head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function QrPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const business = await db.business.findUnique({
    where: { slug },
    include: { locations: true },
  });
  if (!business) notFound();

  const base = await origin();

  const posters = await Promise.all(
    business.locations.map(async (location) => {
      const url = checkInUrl(base, location.id, location.checkInSecret);
      const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
      });
      return { location, url, svg };
    }),
  );

  return (
    <main className="min-h-dvh bg-stone-100 text-stone-900 print:bg-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link
            href={`/dashboard/${business.slug}`}
            className="text-sm text-stone-500 transition hover:text-stone-900"
          >
            ← Înapoi la panou
          </Link>
          <p className="text-sm text-stone-400">
            Tipăriți și lipiți la intrare
          </p>
        </div>

        {posters.map(({ location, url, svg }) => (
          <section
            key={location.id}
            className="mb-6 break-inside-avoid rounded-2xl border border-stone-200 bg-white p-10 text-center print:border-0 print:shadow-none"
          >
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-stone-400">
              {business.name}
            </p>
            <h1 className="mt-3 font-serif text-3xl text-stone-900">
              Ați ajuns? Scanați.
            </h1>
            <p className="mt-2 text-stone-500">
              Confirmați sosirea în două secunde.
            </p>

            <div
              className="mx-auto mt-8 w-64 [&>svg]:h-full [&>svg]:w-full"
              // qrcode renders a self-contained SVG; there is no user input in it.
              dangerouslySetInnerHTML={{ __html: svg }}
            />

            <p className="mt-6 text-sm text-stone-400">{location.name}</p>

            <p className="mt-8 border-t border-stone-100 pt-5 text-xs leading-relaxed text-stone-400">
              Masa este ținută {business.gracePeriodMin} de minute după ora
              rezervării. Scanarea anulează orice taxă de neprezentare.
            </p>

            <p className="mt-4 break-all font-mono text-[10px] text-stone-300 print:hidden">
              {url}
            </p>
          </section>
        ))}

        {posters.length === 0 ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Această locație nu are încă o adresă configurată.
          </p>
        ) : null}
      </div>
    </main>
  );
}
