"use client";

import { useActionState } from "react";

import { confirmScannedArrival } from "./actions";

export function ConfirmArrival({ token, customerName, warning }: { token: string; customerName: string; warning: string | null }) {
  const [state, action, pending] = useActionState(confirmScannedArrival, undefined);

  if (state?.ok) {
    return (
      <div className="stamp rounded-lg border-[3px] border-emerald-700 bg-emerald-50 p-6 text-center [--d:0s] [--r:-2deg]">
        <p className="text-4xl font-bold tracking-tight text-emerald-900">Sosit ✓</p>
        <p className="mt-1 text-emerald-900">{customerName} e înregistrat. Nu se percepe nicio taxă.</p>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      {warning ? (
        <p className="mb-3 rounded-md border-2 border-amber-700 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
          {warning}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="press w-full rounded-lg border-2 border-blue bg-pink px-6 py-5 text-xl font-bold text-ink disabled:opacity-50"
      >
        {pending ? "Se confirmă…" : "Confirmă sosirea"}
      </button>
      {state?.error ? (
        <p role="alert" className="mt-3 text-center text-sm font-semibold text-red-800">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
