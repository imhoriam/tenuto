import Link from "next/link";

import { logout } from "@/app/auth-actions";
import { Logo } from "@/components/logo";
import { requireBusiness } from "@/lib/auth/session";
import { DashboardTabs } from "./tabs";

export default async function DashboardLayout({ children, params }: LayoutProps<"/dashboard/[slug]">) {
  const { slug } = await params;
  const business = await requireBusiness(slug);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b-2 border-blue bg-paper/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" aria-label="Tenuto — acasă" className="shrink-0">
              <Logo />
            </Link>
            <span className="hidden h-6 w-0.5 bg-blue/30 sm:block" />
            <p className="hidden truncate font-mono text-xs font-semibold uppercase tracking-[0.14em] text-blue sm:block">{business.name}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="rounded-md border-2 border-transparent px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-blue transition hover:border-blue">
              Ieșire
            </button>
          </form>
        </div>
        <DashboardTabs slug={business.slug} />
      </header>
      {children}
    </div>
  );
}
