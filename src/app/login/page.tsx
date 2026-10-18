import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { getCurrentAccount } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Autentificare" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const account = await getCurrentAccount();
  if (account) redirect(`/dashboard/${account.business.slug}`);

  const { next } = await searchParams;

  return (
    <AuthShell
      aside={
        <>
          <p className="text-5xl font-bold leading-[0.95] tracking-[-0.05em]">Seara de azi, dintr-o privire.</p>
          <p className="mt-4 max-w-md text-paper/65">
            Cine a sosit, cine întârzie, ce se poate încasa. Totul pe un singur ecran, de la recepție.
          </p>
        </>
      }
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pink-deep">Pentru afaceri</p>
      <h1 className="mt-3 text-5xl font-bold leading-[0.95] tracking-[-0.05em] text-blue">Bine ai revenit</h1>
      <p className="mt-2 text-muted">Intră cu numele de utilizator al afacerii.</p>
      <div className="mt-8">
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>

      {process.env.NODE_ENV !== "production" ? (
        <p className="mt-6 rounded-md border border-dashed border-blue/25 bg-cream/60 px-4 py-3 text-sm text-muted">
          Demo: <span className="font-mono text-ink">hanul-cu-tei</span> /{" "}
          <span className="font-mono text-ink">tenuto-demo</span>
        </p>
      ) : null}

      <p className="mt-8 text-sm text-muted">
        Nu ai cont?{" "}
        <Link href="/register" className="font-semibold text-blue underline decoration-pink decoration-2 underline-offset-4">
          Înregistrează-ți afacerea
        </Link>
      </p>
    </AuthShell>
  );
}
