import Link from "next/link";
import QRCode from "qrcode";

import { CopyButton } from "@/components/copy-button";
import { btn } from "@/components/ui";
import { requireBusiness } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/origin";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: PageProps<"/dashboard/[slug]/share">) {
  const { slug } = await params;
  const business = await requireBusiness(slug);

  const url = `${await requestOrigin()}/book/${business.slug}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const pngDataUrl = await QRCode.toDataURL(url, { margin: 2, width: 1024, errorCorrectionLevel: "M" });

  const embed = `<a href="${url}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#17140f;color:#faf8f4;font:600 15px system-ui,sans-serif;text-decoration:none">Rezervă o masă</a>`;

  const channels = [
    { where: "Instagram", how: "Editează profilul → Link-uri → adaugă linkul." },
    { where: "Google Business Profile", how: "Editează profilul → Linkuri pentru rezervări → lipește linkul." },
    { where: "WhatsApp Business", how: "Setează-l ca mesaj rapid sau în descrierea contului." },
    { where: "Site-ul tău", how: "Folosește butonul de mai jos — codul e gata de lipit." },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-bold tracking-[-0.04em] text-4xl tracking-tight sm:text-5xl">Link și QR de rezervare</h1>
      <p className="mt-2 max-w-xl text-muted">
        Oriunde îl pui, clienții rezervă direct la tine — fără cont, fără aplicație.
        {!business.published ? " Linkul funcționează chiar dacă restaurantul nu apare încă în căutare." : ""}
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border-2 border-blue bg-sheet p-6">
            <p className="text-sm font-medium">Linkul tău</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 truncate rounded-md bg-cream px-4 py-3 font-mono text-sm">{url}</p>
              <div className="flex gap-2">
                <CopyButton text={url} label="Copiază" className={btn.primary} />
                <Link href={`/book/${business.slug}`} target="_blank" className={btn.ghost}>
                  Deschide
                </Link>
              </div>
            </div>
          </section>

          <section className="rounded-lg border-2 border-blue bg-sheet p-6">
            <p className="text-sm font-medium">Unde să-l pui</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {channels.map((c) => (
                <li key={c.where} className="rounded-md bg-cream/70 p-4">
                  <p className="text-sm font-semibold">{c.where}</p>
                  <p className="mt-1 text-sm text-muted">{c.how}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border-2 border-blue bg-sheet p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium">Buton pentru site</p>
              <CopyButton text={embed} label="Copiază codul" />
            </div>
            <div className="mt-4 rounded-md border border-dashed border-blue/25 p-6 text-center">
              {/* Preview of exactly the markup being copied. */}
              <span dangerouslySetInnerHTML={{ __html: embed }} />
            </div>
            <pre className="mt-4 overflow-x-auto rounded-md border-2 border-blue bg-blue p-4 font-mono text-xs leading-relaxed text-paper">{embed}</pre>
          </section>
        </div>

        <aside className="rounded-lg border-2 border-blue bg-sheet p-6 lg:self-start">
          <p className="text-sm font-medium">Cod QR de rezervare</p>
          <p className="mt-1 text-sm text-muted">Pe meniu, pe vitrină, pe bonul fiscal.</p>
          <div
            className="mx-auto mt-5 w-56 [&>svg]:h-full [&>svg]:w-full"
            // qrcode renders a self-contained SVG from our own URL.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div className="mt-5 grid grid-cols-2 gap-2">
            <a href={pngDataUrl} download={`${business.slug}-rezervari.png`} className={btn.small}>
              PNG
            </a>
            <a href={svgDataUrl} download={`${business.slug}-rezervari.svg`} className={btn.small}>
              SVG (tipar)
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}
