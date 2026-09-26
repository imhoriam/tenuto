"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { registerRestaurant } from "@/app/auth-actions";
import { btn, field } from "@/components/ui";
import { slugify } from "@/lib/business-profile";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerRestaurant, undefined);
  const [name, setName] = useState(state?.fields?.restaurantName ?? "");
  const [login, setLogin] = useState(state?.fields?.loginName ?? "");
  const [loginTouched, setLoginTouched] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className={field.label}>Numele restaurantului</span>
        <input
          name="restaurantName"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!loginTouched) setLogin(slugify(e.target.value));
          }}
          required
          autoComplete="organization"
          placeholder="Hanul cu Tei"
          className={field.input}
        />
      </label>

      <label className="block">
        <span className={field.label}>Nume de utilizator</span>
        <input
          name="loginName"
          value={login}
          onChange={(e) => {
            setLoginTouched(true);
            setLogin(e.target.value.toLowerCase());
          }}
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="hanul-cu-tei"
          className={`${field.input} font-mono text-[15px]`}
        />
        <span className={field.hint}>Cu el te autentifici. Litere mici, cifre, punct sau cratimă.</span>
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={field.label}>Parolă</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field.input} />
        </label>
        <label className="block">
          <span className={field.label}>Confirmă parola</span>
          <input name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" className={field.input} />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm text-muted">
        <input name="acceptTerms" type="checkbox" required className="mt-0.5 h-4 w-4 accent-pink" />
        <span>
          Accept{" "}
          <Link href="/legal/termeni" className="text-ink underline underline-offset-2" target="_blank">
            Termenii și condițiile
          </Link>{" "}
          și{" "}
          <Link href="/legal/confidentialitate" className="text-ink underline underline-offset-2" target="_blank">
            Politica de confidențialitate
          </Link>
          .
        </span>
      </label>

      {state?.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={`${btn.primary} w-full py-3.5`}>
        {pending ? "Se creează contul…" : "Creează contul restaurantului"}
      </button>
    </form>
  );
}
