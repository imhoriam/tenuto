import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { label } from "@/components/ui";
import { DISPUTE_WINDOW_DAYS } from "@/lib/constants";
import { LookupForm } from "./lookup-form";

export const metadata: Metadata = {
  title: "Rezervarea mea",
  description: "Vezi o rezervare sau contestă o taxă de neprezentare.",
};

export default function LookupPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_24rem]">
        <div>
          <p className={`${label} text-pink-deep`}>Rezervarea mea</p>
          <h1 className="mt-3 text-5xl font-bold leading-[0.95] tracking-[-0.05em] text-blue sm:text-6xl">
            Ai fost taxat{" "}
            <span className="overprint" data-text="pe nedrept?">
              pe nedrept?
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink">
            Orice taxă de neprezentare stă blocată {DISPUTE_WINDOW_DAYS} zile înainte să ajungă la restaurant. În acest timp o
            poți contesta cu un tap, iar banii nu pleacă nicăieri până nu se rezolvă.
          </p>
          <ul className="mt-8 space-y-3 text-[15px] text-ink">
            {[
              "Restaurantul poate rambursa oricând, dintr-o atingere.",
              "Dacă nu o face, Tenuto verifică istoricul rezervării — ora fiecărui pas e înregistrată.",
              "Restaurantele cu multe contestații sunt verificate și pot fi suspendate.",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 bg-pink" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative self-start">
          <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-lg bg-blue" aria-hidden="true" />
          <div className="relative rounded-lg border-2 border-blue bg-sheet p-6">
            <p className="text-xl font-bold tracking-tight text-blue">Găsește rezervarea</p>
            <p className="mt-1 text-sm text-muted">Codul îl găsești pe ecranul de confirmare.</p>
            <div className="mt-6">
              <LookupForm />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
