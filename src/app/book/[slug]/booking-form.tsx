"use client";

import { useMemo, useState, useTransition } from "react";

import { CopyButton } from "@/components/copy-button";
import { btn, field } from "@/components/ui";
import { REQUIREMENT } from "@/lib/constants";
import { getPolicy, getSlots, submitBooking, type SlotOption } from "./actions";

type Policy = {
  requirement: string;
  feeLabel: string;
  policyText: string;
  ruleName: string;
};

type Confirmation = {
  reference: string;
  requirement: string;
  cardLast4: string | null;
  startAt: string;
  partySize: number;
  customerName: string;
  bookingUrl: string;
  smsSent: boolean;
};

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

/** YYYY-MM-DD + n days, as calendar arithmetic (no timezone involved). */
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function dayChip(iso: string, today: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = new Intl.DateTimeFormat("ro-RO", { weekday: "short", timeZone: "UTC" }).format(date);
  return {
    top: iso === today ? "Azi" : iso === addDays(today, 1) ? "Mâine" : weekday.replace(".", ""),
    day: String(d),
    month: new Intl.DateTimeFormat("ro-RO", { month: "short", timeZone: "UTC" }).format(date).replace(".", ""),
  };
}

export function BookingForm({
  slug,
  service,
  businessName,
  timezone,
  today,
  maxCapacity,
}: {
  slug: string;
  service: { id: string; name: string; description: string | null; durationMin: number; usesPartySize: boolean };
  businessName: string;
  timezone: string;
  today: string;
  maxCapacity: number;
}) {
  const [partySize, setPartySize] = useState(service.usesPartySize ? 2 : 1);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<SlotOption[] | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [policy, setPolicy] = useState<Policy | null>(null);

  const [cardNumber, setCardNumber] = useState("");
  const [accepted, setAccepted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pending, startTransition] = useTransition();

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);

  function loadSlots(nextParty = partySize, nextDate = date) {
    setError(null);
    setSlot(null);
    setPolicy(null);
    startTransition(async () => {
      const res = await getSlots({ slug, serviceId: service.id, date: nextDate, partySize: nextParty });
      if (!res.ok) {
        setError(res.error);
        setSlots([]);
        return;
      }
      setSlots(res.slots);
    });
  }

  function checkPolicy() {
    if (!slot || phone.trim().length < 6 || name.trim().length < 2) return;
    setError(null);
    startTransition(async () => {
      const res = await getPolicy({ slug, serviceId: service.id, phone: phone.trim(), partySize, startAt: slot.iso });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPolicy({ requirement: res.requirement, feeLabel: res.feeLabel, policyText: res.policyText, ruleName: res.ruleName });
    });
  }

  function confirm() {
    if (!slot || !policy) return;
    setError(null);
    startTransition(async () => {
      const res = await submitBooking({
        slug,
        serviceId: service.id,
        resourceId: slot.resourceId,
        startAt: slot.iso,
        partySize,
        name: name.trim(),
        phone: phone.trim(),
        note: note.trim() || undefined,
        cardToken: policy.requirement === REQUIREMENT.NONE ? undefined : cardNumber,
        policyText: policy.policyText,
        accepted: accepted as true,
      });

      if (!res.ok) {
        setError(res.error);
        // The slot went while they were typing — send them back to pick again.
        if ("code" in res && res.code === "slot_taken") {
          setSlot(null);
          setPolicy(null);
          loadSlots();
        }
        return;
      }
      setConfirmation(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (confirmation) {
    return <Pass confirmation={confirmation} timezone={timezone} businessName={businessName} showParty={service.usesPartySize} />;
  }

  const needsCard = policy && policy.requirement !== REQUIREMENT.NONE;
  const cardOk = !needsCard || cardNumber.replace(/\D/g, "").length >= 15;

  return (
    <div className="space-y-10">
      <Step n={1} title={service.usesPartySize ? "Câte persoane și ce zi?" : "Ce zi?"}>
        {service.usesPartySize ? (
        <div className="flex flex-wrap gap-2">
          {PARTY_SIZES.filter((n) => n <= Math.max(maxCapacity, 2)).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPartySize(n);
                if (slots !== null) loadSlots(n, date);
              }}
              aria-pressed={partySize === n}
              className={`h-12 w-12 rounded-md border-2 text-lg font-bold transition ${
                partySize === n
                  ? "border-blue bg-blue text-paper shadow-[3px_3px_0_var(--color-pink)]"
                  : "border-blue/30 bg-sheet text-blue hover:border-blue"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        ) : null}

        <div className={`-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 ${service.usesPartySize ? "mt-5" : ""}`}>
          {days.map((d) => {
            const c = dayChip(d, today);
            const active = d === date;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDate(d);
                  loadSlots(partySize, d);
                }}
                aria-pressed={active}
                className={`flex w-16 shrink-0 flex-col items-center rounded-md border-2 py-2.5 transition ${
                  active
                    ? "border-blue bg-blue text-paper shadow-[3px_3px_0_var(--color-pink)]"
                    : "border-blue/30 bg-sheet text-blue hover:border-blue"
                }`}
              >
                <span className={`font-mono text-[10px] font-semibold uppercase ${active ? "text-paper/75" : "text-muted"}`}>{c.top}</span>
                <span className="text-xl font-bold leading-tight">{c.day}</span>
                <span className={`font-mono text-[10px] uppercase ${active ? "text-paper/75" : "text-muted"}`}>{c.month}</span>
              </button>
            );
          })}
          <label className="flex w-24 shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-blue/40 font-mono text-[10px] font-semibold uppercase text-blue hover:border-blue">
            Altă dată
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => {
                if (!e.target.value) return;
                setDate(e.target.value);
                loadSlots(partySize, e.target.value);
              }}
              className="mt-1 w-20 bg-transparent text-[11px] text-ink outline-none"
            />
          </label>
        </div>

        {slots === null ? (
          <button type="button" onClick={() => loadSlots()} disabled={pending} className={`${btn.primary} mt-6 w-full py-3.5`}>
            {pending ? "Se caută…" : "Vezi orele disponibile"}
          </button>
        ) : null}
      </Step>

      {slots !== null ? (
        <Step n={2} title="La ce oră?">
          {pending && !slot && slots.length === 0 ? (
            <p className="text-sm text-muted">Se caută…</p>
          ) : slots.length === 0 ? (
            <p className="rounded-md border-2 border-dashed border-blue/40 px-4 py-4 text-sm text-ink">
              {service.usesPartySize
                ? `Nu sunt mese libere pentru ${partySize} ${partySize === 1 ? "persoană" : "persoane"} în ziua aleasă.`
                : "Nu mai sunt ore libere în ziua aleasă."}{" "}
              Încearcă altă zi.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((s) => (
                <button
                  key={s.iso}
                  type="button"
                  onClick={() => {
                    setSlot(s);
                    setPolicy(null);
                  }}
                  aria-pressed={slot?.iso === s.iso}
                  className={`rounded-md border-2 py-3 font-mono text-[15px] font-bold tabular-nums transition ${
                    slot?.iso === s.iso
                      ? "border-blue bg-pink text-ink shadow-[3px_3px_0_var(--color-blue)]"
                      : "border-blue/30 bg-sheet text-blue hover:border-blue"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            {service.name} · {service.durationMin % 60 === 0 ? `${service.durationMin / 60} h` : `${service.durationMin} min`}{service.usesPartySize ? " la masă" : ""}
          </p>
        </Step>
      ) : null}

      {slot ? (
        <Step n={3} title="Pe ce nume?">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPolicy(null);
              }}
              onBlur={checkPolicy}
              placeholder="Nume"
              autoComplete="name"
              className={field.input}
            />
            <input
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPolicy(null);
              }}
              onBlur={checkPolicy}
              placeholder="Telefon"
              inputMode="tel"
              autoComplete="tel"
              className={field.input}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={service.usesPartySize ? "Observații (opțional) — ex. „masă la geam”" : "Observații (opțional)"}
              className={`${field.input} sm:col-span-2`}
            />
          </div>
          {!policy ? (
            <button
              type="button"
              onClick={checkPolicy}
              disabled={pending || name.trim().length < 2 || phone.trim().length < 6}
              className={`${btn.primary} mt-5 w-full py-3.5`}
            >
              {pending ? "Se verifică…" : "Continuă"}
            </button>
          ) : null}
        </Step>
      ) : null}

      {policy ? (
        <Step n={4} title="Confirmă">
          <div className={`rounded-lg border-2 p-5 ${needsCard ? "border-blue bg-blue-soft" : "border-emerald-700 bg-emerald-50"}`}>
            <p className="flex items-center gap-2 text-sm font-bold text-blue">
              <span className={`h-2.5 w-2.5 rounded-full ${needsCard ? "bg-pink" : "bg-emerald-500"}`} />
              {needsCard ? `Garanție ${policy.feeLabel} — nu se reține nimic acum` : "Fără card — ești client cunoscut"}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink">{policy.policyText}</p>
          </div>

          {needsCard ? (
            <label className="mt-5 block">
              <span className={field.label}>Card (doar salvat, nu se debitează)</span>
              <input
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                autoComplete="cc-number"
                className={`${field.input} font-mono tracking-wider`}
              />
              <span className={field.hint}>Demo: 4242… reușește · 4000…0002 refuzat · 4000…9995 fonduri insuficiente</span>
            </label>
          ) : null}

          <label className="mt-5 flex items-start gap-3">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-pink"
            />
            <span className="text-sm text-muted">Am citit și accept condițiile de mai sus.</span>
          </label>

          <button type="button" onClick={confirm} disabled={pending || !accepted || !cardOk} className={`${btn.accent} mt-6 w-full py-4 text-base`}>
            {pending ? "Se confirmă…" : "Confirmă rezervarea"}
          </button>
        </Step>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rise">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="overprint text-4xl font-bold leading-none tracking-[-0.06em]" data-text={String(n)}>
          {n}
        </span>
        <h2 className="text-xl font-bold tracking-tight text-blue">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Pass({
  confirmation,
  timezone,
  businessName,
  showParty,
}: {
  confirmation: Confirmation;
  timezone: string;
  businessName: string;
  showParty: boolean;
}) {
  const start = new Date(confirmation.startAt);
  const day = new Intl.DateTimeFormat("ro-RO", { timeZone: timezone, weekday: "long", day: "numeric", month: "long" }).format(start);
  const time = new Intl.DateTimeFormat("ro-RO", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(start);

  return (
    <div className="rise">
      <p className="text-4xl font-bold leading-none tracking-[-0.05em] text-blue">
        <span className="overprint" data-text="Gata.">
          Gata.
        </span>{" "}
        Te așteptăm.
      </p>

      <div className="relative mt-8">
        <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-lg bg-blue" aria-hidden="true" />
        <div className="perforated relative rounded-lg border-2 border-blue bg-paper">
          <div className="relative px-6 pb-5 pt-8">
            <div className="stamp absolute right-4 top-7 rounded-md border-[3px] border-pink px-2.5 py-1 text-center text-pink mix-blend-multiply [--d:0.25s] [--r:-10deg]">
              <p className="text-base font-bold leading-none tracking-tight">CONFIRMAT</p>
            </div>
            <p className="pr-32 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-blue">
              Rezervare · {confirmation.reference}
            </p>
            <p className="mt-3 text-3xl font-bold leading-none tracking-[-0.04em] text-blue">{businessName}</p>
            <p className="mt-2 capitalize text-ink">
              {day} · <b>{time}</b>
            </p>
          </div>
          <div className={`grid border-y-2 border-dashed border-blue/40 ${showParty ? "grid-cols-2" : ""}`}>
            {showParty ? (
              <div className="border-r-2 border-dashed border-blue/40 px-6 py-4">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Persoane</p>
                <p className="mt-0.5 text-2xl font-bold text-blue">{confirmation.partySize}</p>
              </div>
            ) : null}
            <div className="px-6 py-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Plătit acum</p>
              <p className="mt-0.5 text-2xl font-bold text-blue">0 lei</p>
            </div>
          </div>
          <div className="relative px-6 pb-8 pt-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">La sosire</p>
            <p className="mt-1 max-w-[16rem] text-[15px] leading-snug text-ink">
              Arată codul QR de pe pagina rezervării, sau spune numele: <b className="text-blue">{confirmation.customerName}</b>.
            </p>
            <p className="mt-3 text-xs text-muted">
              {confirmation.cardLast4 ? `Card ••${confirmation.cardLast4} salvat — nu s-a reținut nimic.` : "Fără card."}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border-2 border-blue bg-blue-soft p-4">
        <p className="text-sm font-bold text-blue">
          {confirmation.smsSent ? "Ți-am trimis un SMS cu rezervarea." : "Pagina rezervării tale"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink">
          {confirmation.smsSent
            ? "În el găsești adresa și linkul spre pagina rezervării, cu codul QR pe care îl arăți la sosire."
            : "Păstrează linkul: are adresa și codul QR pe care îl arăți la sosire."}{" "}
          Tot de acolo contești cu un tap, dacă ești vreodată taxat pe nedrept.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={confirmation.bookingUrl} className={btn.primary}>
            Deschide
          </a>
          <CopyButton text={confirmation.bookingUrl} label="Copiază linkul" className={btn.ghost} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Nu mai poți ajunge? Anunță-i din timp — anularea în termenul afișat e gratuită, iar locul ajunge la altcineva.
      </p>
    </div>
  );
}
