import Link from "next/link";

import { OPERATOR } from "@/lib/legal";
import { Mark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-blue text-paper">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-10 pt-16 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <p className="max-w-xs text-lg font-medium leading-snug">
            Rezervări pentru orice afacere. Garanția e ținută, rezervarea e onorată, nimeni nu plătește ca să rezerve.
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-paper/60">
            ten·u·to — ținut, în caz că nu vii
          </p>
        </div>
        <FooterCol
          title="Clienți"
          links={[
            { href: "/restaurants", label: "Caută unde rezervi" },
            { href: "/rezervare", label: "Rezervarea mea · contestă o taxă" },
            { href: "/legal/politica-neprezentare", label: "Taxa de neprezentare" },
          ]}
        />
        <FooterCol
          title="Afaceri"
          links={[
            { href: "/register", label: "Înregistrare" },
            { href: "/login", label: "Intră în cont" },
            { href: "/#pentru-afaceri", label: "Ce primești" },
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            { href: "/legal/termeni", label: "Termeni și condiții" },
            { href: "/legal/confidentialitate", label: "Confidențialitate" },
            { href: "/legal/cookies", label: "Cookie-uri" },
            { href: "/legal/politica-neprezentare", label: "Neprezentare" },
          ]}
        />
      </div>

      {/* The wordmark, set as big as the sheet allows, cropped by the edge. */}
      <div className="relative overflow-hidden" aria-hidden="true">
        <div className="mx-auto flex w-full max-w-6xl items-end gap-4 px-4 sm:px-6">
          <Mark onDark className="mb-[3vw] h-[11vw] w-[11vw] max-h-40 max-w-40 shrink-0" />
          <p className="translate-y-[18%] select-none text-[23vw] font-bold leading-[0.8] tracking-[-0.07em] text-paper lg:text-[15.5rem]">
            tenuto
          </p>
        </div>
      </div>

      <div className="border-t-2 border-paper/20">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 font-mono text-[11px] uppercase tracking-[0.12em] text-paper/60 sm:px-6">
          <p>
            © {new Date().getFullYear()} {OPERATOR.legalName} · CUI {OPERATOR.taxId}
          </p>
          <p className="flex gap-4">
            <a href="https://anpc.ro" className="hover:text-paper" rel="noopener noreferrer" target="_blank">
              ANPC
            </a>
            <a href="https://ec.europa.eu/consumers/odr" className="hover:text-paper" rel="noopener noreferrer" target="_blank">
              SOL
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pink-soft">{title}</p>
      <ul className="mt-4 space-y-2 text-[15px]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-paper/85 underline-offset-4 transition hover:text-paper hover:underline hover:decoration-pink hover:decoration-2">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
