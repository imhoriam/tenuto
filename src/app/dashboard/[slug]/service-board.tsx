"use client";

import { useState, useTransition } from "react";

import { BOOKING_STATUS, REQUIREMENT, type BookingStatus } from "@/lib/constants";
import { chargeAllAction, checkInAction, waiveAction } from "./actions";

export interface Row {
  id: string;
  reference: string;
  time: string;
  day: string;
  isToday: boolean;
  partySize: number;
  table: string;
  customerName: string;
  customerPhone: string;
  note: string | null;
  status: BookingStatus;
  requirement: string;
  feeLabel: string | null;
  cardLast4: string | null;
  hint: string | null;
  arrivedAt: string | null;
  chargeError: string | null;
}

const STATUS: Partial<Record<BookingStatus, { label: string; tone: string }>> = {
  [BOOKING_STATUS.CONFIRMED]: { label: "Așteptat", tone: "border-blue/30 bg-blue-soft text-blue" },
  [BOOKING_STATUS.CHECKED_IN]: { label: "Sosit ✓", tone: "border-emerald-700 bg-emerald-100 text-emerald-900" },
  [BOOKING_STATUS.COMPLETED]: { label: "Încheiat", tone: "border-blue/20 bg-paper text-muted" },
  [BOOKING_STATUS.NO_SHOW_PENDING]: { label: "Neprezentare", tone: "border-amber-700 bg-amber-100 text-amber-950" },
  [BOOKING_STATUS.CHARGE_SUCCEEDED]: { label: "Taxat", tone: "border-blue bg-blue text-paper" },
  [BOOKING_STATUS.CHARGE_FAILED]: { label: "Card refuzat", tone: "border-red-700 bg-red-100 text-red-900" },
  [BOOKING_STATUS.CANCELLED_FREE]: { label: "Anulat", tone: "border-blue/20 bg-paper text-faint" },
  [BOOKING_STATUS.CANCELLED_LATE]: { label: "Anulat târziu", tone: "border-amber-700 bg-amber-100 text-amber-950" },
  [BOOKING_STATUS.WAIVED]: { label: "Iertat", tone: "border-blue/20 bg-paper text-muted" },
  [BOOKING_STATUS.DISPUTED]: { label: "Contestat", tone: "border-red-700 bg-red-100 text-red-900" },
};

const RESCUABLE: BookingStatus[] = [BOOKING_STATUS.NO_SHOW_PENDING];
/** Not yet collected: waiving simply cancels the fee. */
const FORGIVABLE: BookingStatus[] = [
  BOOKING_STATUS.NO_SHOW_PENDING,
  BOOKING_STATUS.CANCELLED_LATE,
  BOOKING_STATUS.CHARGE_FAILED,
];
/** Money already taken: waiving refunds it. */
const REFUNDABLE: BookingStatus[] = [BOOKING_STATUS.CHARGE_SUCCEEDED, BOOKING_STATUS.DISPUTED];

type Filter = "all" | "waiting" | "arrived" | "absent";

export function ServiceBoard({
  slug,
  rows,
  dueCount,
  dueLabel,
  suspended,
}: {
  slug: string;
  rows: Row[];
  dueCount: number;
  dueLabel: string;
  suspended: boolean;
}) {
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  function run(
    id: string | null,
    fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>,
  ) {
    setBusyId(id);
    setFlash(null);
    startTransition(async () => {
      const res = await fn();
      setFlash(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      setBusyId(null);
    });
  }

  const counts = {
    all: rows.length,
    waiting: rows.filter((r) => r.status === BOOKING_STATUS.CONFIRMED).length,
    arrived: rows.filter((r) => r.status === BOOKING_STATUS.CHECKED_IN).length,
    absent: rows.filter((r) => FORGIVABLE.includes(r.status) || REFUNDABLE.includes(r.status)).length,
  };

  // The host asks "on what name?" — match name, phone or reference, ignoring
  // case and diacritics, so "stefan" finds "Ștefan".
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const needle = fold(query.trim());
  const digits = query.replace(/\D/g, "");

  const visible = rows.filter((r) => {
    if (needle) {
      const hit =
        fold(r.customerName).includes(needle) ||
        fold(r.reference).includes(needle) ||
        (digits.length >= 3 && r.customerPhone.replace(/\D/g, "").includes(digits));
      if (!hit) return false;
    }
    if (filter === "waiting") return r.status === BOOKING_STATUS.CONFIRMED;
    if (filter === "arrived") return r.status === BOOKING_STATUS.CHECKED_IN;
    if (filter === "absent") return FORGIVABLE.includes(r.status) || REFUNDABLE.includes(r.status);
    return true;
  });

  return (
    <section className="mt-8">
      {/* The charge bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-lg border-2 border-blue bg-blue p-5 text-paper sm:p-6">
        <div aria-hidden="true" className="halftone-pink pointer-events-none absolute -right-8 -top-8 h-40 w-72 opacity-40 [mask-image:radial-gradient(circle_at_80%_20%,#000,transparent_70%)]" />
        <div className="relative">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-pink-soft">Neprezentări de încasat</p>
          <p className="mt-1 text-2xl font-bold tracking-[-0.03em]">
            {dueCount > 0 ? `${dueCount} ${dueCount === 1 ? "scadentă" : "scadente"} · ${dueLabel}` : "Nimic scadent acum"}
          </p>
          <p className="mt-1 text-sm text-paper/80">
            {suspended
              ? "Încasările sunt oprite cât timp contul e suspendat."
              : "Doar neprezentările de după toleranță. Banii ajung la tine după perioada de contestare."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => run(null, () => chargeAllAction({ slug }))}
          disabled={pending || dueCount === 0 || suspended}
          className="relative inline-flex items-center gap-2 rounded-md border-2 border-paper bg-pink px-6 py-3 text-[15px] font-bold text-ink shadow-[4px_4px_0_var(--color-paper)] transition hover:-translate-x-px hover:-translate-y-px active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--color-paper)] disabled:cursor-not-allowed disabled:border-paper/30 disabled:bg-transparent disabled:text-paper/60 disabled:shadow-none"
        >
          {pending && busyId === null ? "Se încasează…" : "Încasează toate absențele"}
        </button>
      </div>

      {flash ? (
        <p
          role="status"
          className={`mt-4 rounded-md border-2 px-4 py-3 text-sm font-medium ${
            flash.ok ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-amber-700 bg-amber-50 text-amber-950"
          }`}
        >
          {flash.text}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-md border-2 border-blue bg-sheet px-4 transition focus-within:shadow-[3px_3px_0_var(--color-pink)] sm:max-w-sm">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-faint" aria-hidden="true">
            <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Caută după nume</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pe ce nume? (sau telefon, cod)"
            autoComplete="off"
            className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-faint"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="text-sm text-muted hover:text-ink" aria-label="Șterge căutarea">
              ✕
            </button>
          ) : null}
        </label>
        <div className="flex gap-1 overflow-x-auto rounded-md border-2 border-blue bg-sheet p-1 text-sm">
          {(
            [
              ["all", "Toate"],
              ["waiting", "Așteptați"],
              ["arrived", "Sosiți"],
              ["absent", "Absenți"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded px-3 py-1.5 font-semibold transition ${filter === key ? "bg-blue text-paper" : "text-blue hover:bg-blue-soft"}`}
            >
              {label} <span className="tabular-nums opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border-2 border-blue bg-sheet">
        {visible.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-muted">
            {query ? `Nicio rezervare pe „${query}” în fereastra curentă.` : "Nicio rezervare aici."}
          </p>
        ) : (
          <ul className="divide-y-2 divide-dashed divide-blue/20">
            {visible.map((row) => {
              const s = STATUS[row.status] ?? { label: row.status, tone: "bg-cream text-muted" };
              const busy = pending && busyId === row.id;
              return (
                <li
                  key={row.id}
                  className={`grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center ${
                    row.status === BOOKING_STATUS.CANCELLED_FREE ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums leading-none text-blue">{row.time}</p>
                    <p className="mt-1 text-xs text-faint">{row.isToday ? row.table : row.day.split(",")[0]}</p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[17px] font-bold tracking-tight text-ink">{row.customerName}</p>
                      <span className="text-sm text-faint">· {row.partySize} pers. · {row.table}</span>
                      <span className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${s.tone}`}>{s.label}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      <span className="font-mono">{row.reference}</span>
                      {row.requirement === REQUIREMENT.NONE ? " · client fidel, fără card" : ""}
                      {row.cardLast4 ? ` · card ••${row.cardLast4}` : ""}
                      {row.feeLabel ? ` · taxă ${row.feeLabel}` : ""}
                      {row.arrivedAt ? ` · sosit la ${row.arrivedAt}` : ""}
                    </p>
                    {row.note ? <p className="mt-1 text-xs italic text-muted">„{row.note}”</p> : null}
                    {row.hint ? <p className="mt-1 font-mono text-xs font-semibold text-amber-900">{row.hint}</p> : null}
                    {row.chargeError ? <p className="mt-1 text-xs text-red-700">{row.chargeError}</p> : null}
                  </div>

                  <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
                    {row.status === BOOKING_STATUS.CONFIRMED ? (
                      <button
                        type="button"
                        onClick={() => run(row.id, () => checkInAction({ slug, bookingId: row.id }))}
                        disabled={pending}
                        className="press rounded-md border-2 border-blue bg-pink px-4 py-2 text-sm font-bold text-ink disabled:opacity-50"
                      >
                        {busy ? "…" : "A sosit"}
                      </button>
                    ) : null}
                    {RESCUABLE.includes(row.status) ? (
                      <button
                        type="button"
                        onClick={() => run(row.id, () => checkInAction({ slug, bookingId: row.id }))}
                        disabled={pending}
                        className="press rounded-md border-2 border-blue bg-pink px-4 py-2 text-sm font-bold text-ink disabled:opacity-50"
                      >
                        A venit totuși
                      </button>
                    ) : null}
                    {FORGIVABLE.includes(row.status) && row.feeLabel ? (
                      <button
                        type="button"
                        onClick={() => run(row.id, () => waiveAction({ slug, bookingId: row.id }))}
                        disabled={pending}
                        className="rounded-md border-2 border-blue bg-sheet px-4 py-2 text-sm font-bold text-blue transition hover:bg-blue-soft disabled:opacity-50"
                      >
                        Iartă
                      </button>
                    ) : null}
                    {REFUNDABLE.includes(row.status) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Rambursezi ${row.feeLabel ?? "taxa"} lui ${row.customerName}?`)) {
                            run(row.id, () => waiveAction({ slug, bookingId: row.id }));
                          }
                        }}
                        disabled={pending}
                        className="rounded-md border-2 border-blue bg-sheet px-4 py-2 text-sm font-bold text-blue transition hover:bg-blue-soft disabled:opacity-50"
                      >
                        Rambursează
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        Clientul are un cod QR în SMS: scanează-l cu camera telefonului și confirmi sosirea dintr-o atingere. Se actualizează
        singur. La finalul toleranței masa se eliberează și neprezentarea se înregistrează automat. Dacă
        clientul ajunge totuși, apasă „A venit totuși” înainte să încasezi și nu se taxează nimic.
      </p>
    </section>
  );
}
