"use client";

import { useState, useTransition } from "react";

import { BOOKING_STATUS, REQUIREMENT, type BookingStatus } from "@/lib/constants";
import {
  checkInAction,
  markAbsentAction,
  runCollectionAction,
  waiveAction,
} from "./actions";

export interface Row {
  id: string;
  reference: string;
  time: string;
  day: string;
  startAtIso: string;
  partySize: number;
  table: string;
  customerName: string;
  customerPhone: string;
  note: string | null;
  status: BookingStatus;
  requirement: string;
  feeLabel: string | null;
  cardLast4: string | null;
  canMarkAbsent: boolean;
  blockedReason: string | null;
  chargeStatus: string | null;
  chargeError: string | null;
  isActive: boolean;
}

const STATUS_LABEL: Partial<Record<BookingStatus, string>> = {
  [BOOKING_STATUS.CONFIRMED]: "Confirmat",
  [BOOKING_STATUS.CHECKED_IN]: "Sosit",
  [BOOKING_STATUS.COMPLETED]: "Încheiat",
  [BOOKING_STATUS.NO_SHOW_PENDING]: "Absent — se taxează",
  [BOOKING_STATUS.CHARGE_SUCCEEDED]: "Taxat",
  [BOOKING_STATUS.CHARGE_FAILED]: "Taxare eșuată",
  [BOOKING_STATUS.CANCELLED_FREE]: "Anulat",
  [BOOKING_STATUS.CANCELLED_LATE]: "Anulat târziu",
  [BOOKING_STATUS.WAIVED]: "Iertat",
  [BOOKING_STATUS.DISPUTED]: "Contestat",
};

const STATUS_TONE: Partial<Record<BookingStatus, string>> = {
  [BOOKING_STATUS.CONFIRMED]: "bg-stone-100 text-stone-600",
  [BOOKING_STATUS.CHECKED_IN]: "bg-emerald-100 text-emerald-700",
  [BOOKING_STATUS.NO_SHOW_PENDING]: "bg-amber-100 text-amber-800",
  [BOOKING_STATUS.CHARGE_SUCCEEDED]: "bg-emerald-100 text-emerald-700",
  [BOOKING_STATUS.CHARGE_FAILED]: "bg-red-100 text-red-700",
  [BOOKING_STATUS.WAIVED]: "bg-stone-100 text-stone-500",
};

export function ServiceBoard({ slug, rows }: { slug: string; rows: Row[] }) {
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function run(
    id: string | null,
    fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>,
  ) {
    setBusyId(id);
    setFlash(null);
    startTransition(async () => {
      const res = await fn();
      setFlash(
        res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error },
      );
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium text-stone-700">Rezervări</h2>
        <button
          type="button"
          onClick={() => run(null, () => runCollectionAction({ slug }))}
          disabled={pending}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 transition hover:border-stone-400 disabled:opacity-50"
        >
          {pending && busyId === null ? "Se rulează…" : "Rulează încasările"}
        </button>
      </div>

      {flash ? (
        <p
          role="status"
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            flash.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {flash.text}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-stone-400">
            Nicio rezervare în fereastra curentă.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 ${
                  row.isActive ? "" : "opacity-50"
                }`}
              >
                <div className="w-14 shrink-0">
                  <p className="font-semibold tabular-nums text-stone-900">
                    {row.time}
                  </p>
                  <p className="text-[11px] text-stone-400">{row.table}</p>
                </div>

                <div className="min-w-[10rem] flex-1">
                  <p className="font-medium text-stone-900">
                    {row.customerName}{" "}
                    <span className="text-stone-400">· {row.partySize}p</span>
                  </p>
                  <p className="text-xs text-stone-400">
                    {row.reference}
                    {row.cardLast4 ? ` · card ••${row.cardLast4}` : ""}
                    {row.requirement === REQUIREMENT.NONE ? " · client fidel" : ""}
                    {row.feeLabel ? ` · ${row.feeLabel}` : ""}
                  </p>
                  {row.note ? (
                    <p className="mt-0.5 text-xs italic text-stone-500">
                      “{row.note}”
                    </p>
                  ) : null}
                  {row.chargeError ? (
                    <p className="mt-0.5 text-xs text-red-600">{row.chargeError}</p>
                  ) : null}
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    STATUS_TONE[row.status] ?? "bg-stone-100 text-stone-500"
                  }`}
                >
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>

                <div className="flex shrink-0 items-center gap-2">
                  {row.status === BOOKING_STATUS.CONFIRMED ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          run(row.id, () =>
                            checkInAction({ slug, bookingId: row.id }),
                          )
                        }
                        disabled={pending}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        A sosit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          run(row.id, () =>
                            markAbsentAction({ slug, bookingId: row.id }),
                          )
                        }
                        disabled={pending || !row.canMarkAbsent}
                        title={row.blockedReason ?? undefined}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 transition hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Absent
                      </button>
                    </>
                  ) : null}

                  {row.status === BOOKING_STATUS.NO_SHOW_PENDING ||
                  row.status === BOOKING_STATUS.CHARGE_FAILED ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          run(row.id, () =>
                            checkInAction({ slug, bookingId: row.id }),
                          )
                        }
                        disabled={pending || row.status !== BOOKING_STATUS.NO_SHOW_PENDING}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
                      >
                        A venit totuși
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          run(row.id, () => waiveAction({ slug, bookingId: row.id }))
                        }
                        disabled={pending}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 transition hover:border-stone-400 disabled:opacity-50"
                      >
                        Iartă
                      </button>
                    </>
                  ) : null}
                </div>

                {row.blockedReason &&
                row.status === BOOKING_STATUS.CONFIRMED ? (
                  <p className="w-full text-xs text-stone-400">
                    {row.blockedReason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
