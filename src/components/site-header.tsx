import Link from "next/link";

import { getCurrentAccount } from "@/lib/auth/session";
import { Logo } from "./logo";
import { btn } from "./ui";

const NAV = [
  { href: "/#cum-functioneaza", label: "Cum funcționează" },
  { href: "/#pentru-afaceri", label: "Pentru afaceri" },
  { href: "/restaurants", label: "Caută unde rezervi" },
  { href: "/legal", label: "Legal" },
];

export async function SiteHeader() {
  const account = await getCurrentAccount();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-blue bg-paper/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Tenuto — acasă">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-blue transition hover:bg-blue hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {account ? (
            <Link href={`/dashboard/${account.business.slug}`} className={btn.primary}>
              Panoul meu →
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-blue underline decoration-pink decoration-2 underline-offset-4">
                Intră în cont
              </Link>
              <Link href="/register" className={btn.primary}>
                Înregistrează-ți afacerea
              </Link>
            </>
          )}
        </div>

        {/* Mobile: a native disclosure, so the menu works without client JS. */}
        <details className="group/menu relative md:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border-2 border-blue bg-sheet text-blue [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Meniu</span>
            <svg viewBox="0 0 20 20" className="h-4 w-4 group-open/menu:hidden" aria-hidden="true">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
            </svg>
            <svg viewBox="0 0 20 20" className="hidden h-4 w-4 group-open/menu:block" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
            </svg>
          </summary>
          <div className="absolute right-0 top-12 w-64 rounded-lg border-2 border-blue bg-sheet p-2 shadow-[var(--shadow-print)]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-blue hover:bg-blue-soft"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 space-y-2 border-t-2 border-dashed border-blue/30 pt-3">
              {account ? (
                <Link href={`/dashboard/${account.business.slug}`} className={`${btn.primary} w-full`}>
                  Panoul meu
                </Link>
              ) : (
                <>
                  <Link href="/register" className={`${btn.primary} w-full`}>
                    Înregistrează-ți afacerea
                  </Link>
                  <Link href="/login" className={`${btn.ghost} w-full`}>
                    Intră în cont
                  </Link>
                </>
              )}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
