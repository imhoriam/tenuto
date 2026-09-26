import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { getCurrentAccount } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Înregistrează restaurantul" };

export default async function RegisterPage() {
  const account = await getCurrentAccount();
  if (account) redirect(`/dashboard/${account.business.slug}`);

  return (
    <AuthShell
      aside={
        <>
          <p className="text-5xl font-bold leading-[0.95] tracking-[-0.05em]">
            Protejează-te de cei 10% care nu vin.
          </p>
          <p className="mt-4 max-w-md text-paper/65">Fără să-ți sperii clienții fideli.</p>
          <ol className="mt-10 space-y-3 text-sm text-paper/80">
            {["Contul restaurantului", "Profilul, ca pe Google", "Datele firmei", "Mese, toleranță, taxă — și primești linkul"].map(
              (s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-paper/20 font-mono text-xs">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ),
            )}
          </ol>
        </>
      }
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-pink-deep">Pasul 1 din 4</p>
      <h1 className="mt-3 text-5xl font-bold leading-[0.95] tracking-[-0.05em] text-blue">Înregistrează-ți restaurantul</h1>
      <p className="mt-2 text-muted">Durează un minut. Profilul îl completezi imediat după.</p>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-8 text-sm text-muted">
        Ai deja cont?{" "}
        <Link href="/login" className="font-semibold text-blue underline decoration-pink decoration-2 underline-offset-4">
          Autentifică-te
        </Link>
      </p>
    </AuthShell>
  );
}
