"use client";

import { useActionState } from "react";

import { btn, field } from "@/components/ui";
import { findBooking } from "./actions";

export function LookupForm() {
  const [state, action, pending] = useActionState(findBooking, undefined);
  return (
    <form action={action} className="space-y-5">
      <label className="block">
        <span className={field.label}>Codul rezervării</span>
        <input
          name="reference"
          defaultValue={state?.reference}
          required
          placeholder="TNT-4F7K2"
          autoCapitalize="characters"
          spellCheck={false}
          className={`${field.input} font-mono uppercase tracking-[0.2em]`}
        />
      </label>
      <label className="block">
        <span className={field.label}>Telefonul cu care ai rezervat</span>
        <input name="phone" required inputMode="tel" autoComplete="tel" placeholder="07xx xxx xxx" className={field.input} />
      </label>
      {state?.error ? (
        <p role="alert" className="rounded-md border-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={`${btn.primary} w-full py-3`}>
        {pending ? "Se caută…" : "Deschide rezervarea"}
      </button>
    </form>
  );
}
