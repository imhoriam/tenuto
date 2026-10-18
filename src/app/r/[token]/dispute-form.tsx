"use client";

import { useActionState, useState } from "react";

import { btn, field } from "@/components/ui";
import { disputeFee } from "./actions";

export function DisputeForm({ token, amount, until }: { token: string; amount: string; until: string }) {
  const [state, action, pending] = useActionState(disputeFee, undefined);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className={`${btn.primary} w-full py-3 text-base`}>
          Contestă taxa
        </button>
        <p className="mt-2 text-center text-xs text-muted">Poți contesta până pe {until}.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block">
        <span className={field.label}>Ce s-a întâmplat? (opțional)</span>
        <textarea
          name="reason"
          rows={3}
          maxLength={1000}
          placeholder="Ex.: am ajuns la 20:05 și am stat la masă, dar sosirea nu a fost marcată."
          className={field.input}
        />
      </label>
      <p className="text-sm leading-relaxed text-ink">
        Cei {amount} rămân blocați și nu ajung la restaurant până la rezolvare. Restaurantul îi poate rambursa oricând;
        altfel, Tenuto verifică istoricul rezervării.
      </p>
      {state?.error ? (
        <p role="alert" className="rounded-md border-2 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className={`${btn.primary} flex-1`}>
          {pending ? "Se trimite…" : "Trimite contestația"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btn.ghost}>
          Renunț
        </button>
      </div>
    </form>
  );
}
