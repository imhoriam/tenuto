"use client";

import { useActionState } from "react";

import { login } from "@/app/auth-actions";
import { btn, field } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="block">
        <span className={field.label}>Nume de utilizator</span>
        <input
          name="loginName"
          defaultValue={state?.fields?.loginName}
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className={`${field.input} font-mono text-[15px]`}
        />
      </label>
      <label className="block">
        <span className={field.label}>Parolă</span>
        <input name="password" type="password" required autoComplete="current-password" className={field.input} />
      </label>

      {state?.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className={`${btn.primary} w-full py-3.5`}>
        {pending ? "Se verifică…" : "Intră în panou"}
      </button>
    </form>
  );
}
