"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${slug}`;
  const tabs = [
    { href: base, label: "Seara de azi" },
    { href: `${base}/share`, label: "Link și QR" },
    { href: `${base}/settings`, label: "Setări" },
  ];

  return (
    <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`relative -mb-0.5 shrink-0 rounded-t-md border-2 border-b-0 px-4 py-2.5 text-sm font-bold tracking-tight transition ${
              active ? "border-blue bg-sheet text-blue" : "border-transparent text-muted hover:text-blue"
            }`}
          >
            {t.label}
            {active ? <span className="absolute inset-x-4 top-0 h-1 bg-pink" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
