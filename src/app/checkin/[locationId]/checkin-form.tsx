"use client";

import { useState, useTransition } from "react";

import { checkInAtVenue, type CheckInResult } from "./actions";

export function CheckInForm({
  locationId,
  venueKey,
  gracePeriodMin,
}: {
  locationId: string;
  venueKey: string;
  gracePeriodMin: number;
}) {
  const [lookup, setLookup] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Geolocation is corroborating evidence, never a gate: indoor GPS is
   * unreliable and a denied permission must not stop someone checking in.
   * Resolves to undefined rather than rejecting.
   */
  function coords(): Promise<{ lat?: number; lng?: number }> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      const done = setTimeout(() => resolve({}), 3000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(done);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(done);
          resolve({});
        },
        { timeout: 3000, maximumAge: 60_000 },
      );
    });
  }

  function submit() {
    if (lookup.trim().length < 3) return;
    startTransition(async () => {
      const where = await coords();
      const res = await checkInAtVenue({
        locationId,
        key: venueKey,
        lookup: lookup.trim(),
        ...where,
      });
      setResult(res);
    });
  }

  if (result?.ok) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-3xl">
          ✓
        </div>
        <h2 className="mt-4 font-serif text-2xl text-emerald-100">
          {result.alreadyCheckedIn ? "Deja înregistrat" : "Sosire înregistrată"}
        </h2>
        <p className="mt-1 text-emerald-200/80">{result.customerName}</p>

        <dl className="mt-6 space-y-1.5 border-t border-emerald-500/20 pt-5 text-sm">
          <Line label="Masa" value={result.table} />
          <Line label="Ora" value={result.time} />
          <Line
            label="Persoane"
            value={String(result.partySize)}
          />
          <Line label="Cod" value={result.reference} mono />
        </dl>

        <p className="mt-6 text-sm text-emerald-200/70">
          Nu se mai reține nimic. Un coleg vine imediat.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <label className="block">
        <span className="mb-2 block text-sm text-stone-400">
          Numărul de telefon sau codul rezervării
        </span>
        <input
          value={lookup}
          onChange={(e) => {
            setLookup(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="0721 111 111"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
          className="w-full rounded-xl border border-stone-700 bg-stone-800 px-4 py-3.5 text-lg text-stone-50 placeholder:text-stone-600 outline-none focus:border-stone-400"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={pending || lookup.trim().length < 3}
        className="mt-4 w-full rounded-xl bg-stone-50 px-4 py-4 text-lg font-medium text-stone-900 transition hover:bg-white disabled:opacity-30"
      >
        {pending ? "Se verifică…" : "Am ajuns"}
      </button>

      {result && !result.ok ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          {result.error}
        </p>
      ) : null}

      <p className="mt-8 text-center text-xs leading-relaxed text-stone-500">
        Masa este ținută {gracePeriodMin} de minute după ora rezervării.
        Înregistrarea sosirii anulează orice taxă.
      </p>
    </div>
  );
}

function Line({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-emerald-200/60">{label}</dt>
      <dd
        className={`font-medium text-emerald-50 ${mono ? "font-mono tracking-wider" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
