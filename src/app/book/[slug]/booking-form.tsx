"use client";

import { useState, useTransition } from "react";

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
};

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

export function BookingForm({
  slug,
  service,
  timezone,
  today,
  maxCapacity,
}: {
  slug: string;
  service: { id: string; name: string; description: string | null; durationMin: number };
  timezone: string;
  today: string;
  maxCapacity: number;
}) {
  const [partySize, setPartySize] = useState(2);
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

  function loadSlots(nextParty = partySize, nextDate = date) {
    setError(null);
    setSlot(null);
    setPolicy(null);
    startTransition(async () => {
      const res = await getSlots({
        slug,
        serviceId: service.id,
        date: nextDate,
        partySize: nextParty,
      });
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
      const res = await getPolicy({
        slug,
        serviceId: service.id,
        phone: phone.trim(),
        partySize,
        startAt: slot.iso,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPolicy({
        requirement: res.requirement,
        feeLabel: res.feeLabel,
        policyText: res.policyText,
        ruleName: res.ruleName,
      });
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
        cardToken:
          policy.requirement === REQUIREMENT.NONE ? undefined : cardNumber,
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
    });
  }

  if (confirmation) {
    return <Confirmed confirmation={confirmation} timezone={timezone} />;
  }

  const needsCard = policy && policy.requirement !== REQUIREMENT.NONE;
  const cardOk = !needsCard || cardNumber.replace(/\D/g, "").length >= 15;

  return (
    <div className="space-y-8">
      {/* Step 1 — party + date */}
      <Section step={1} title="Câte persoane?">
        <div className="flex flex-wrap gap-2">
          {PARTY_SIZES.filter((n) => n <= Math.max(maxCapacity, 2)).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setPartySize(n);
                loadSlots(n, date);
              }}
              className={`h-11 w-11 rounded-full border text-sm font-medium transition ${
                partySize === n
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm text-stone-600">Data</span>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => {
              setDate(e.target.value);
              loadSlots(partySize, e.target.value);
            }}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-stone-900"
          />
        </label>

        {slots === null ? (
          <button
            type="button"
            onClick={() => loadSlots()}
            disabled={pending}
            className="mt-5 w-full rounded-lg bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
          >
            {pending ? "Se caută…" : "Vezi orele disponibile"}
          </button>
        ) : null}
      </Section>

      {/* Step 2 — time */}
      {slots !== null ? (
        <Section step={2} title="La ce oră?">
          {slots.length === 0 ? (
            <p className="text-sm text-stone-500">
              Nu sunt mese libere pentru {partySize}{" "}
              {partySize === 1 ? "persoană" : "persoane"} în ziua aleasă.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s.iso}
                  type="button"
                  onClick={() => {
                    setSlot(s);
                    setPolicy(null);
                  }}
                  className={`rounded-lg border py-2.5 text-sm font-medium transition ${
                    slot?.iso === s.iso
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-stone-400">
            {service.name} · {service.durationMin / 60} h la masă
          </p>
        </Section>
      ) : null}

      {/* Step 3 — who */}
      {slot ? (
        <Section step={3} title="Cine rezervă?">
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={checkPolicy}
              placeholder="Nume"
              autoComplete="name"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-stone-900"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={checkPolicy}
              placeholder="Telefon"
              inputMode="tel"
              autoComplete="tel"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-stone-900"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observații (opțional)"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-stone-900"
            />
          </div>

          {!policy ? (
            <button
              type="button"
              onClick={checkPolicy}
              disabled={pending || name.trim().length < 2 || phone.trim().length < 6}
              className="mt-4 w-full rounded-lg bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
            >
              {pending ? "Se verifică…" : "Continuă"}
            </button>
          ) : null}
        </Section>
      ) : null}

      {/* Step 4 — policy + card */}
      {policy ? (
        <Section step={4} title="Confirmare">
          <div
            className={`rounded-xl border p-4 ${
              needsCard
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <p className="text-sm leading-relaxed text-stone-700">
              {policy.policyText}
            </p>
            <p className="mt-2 text-xs text-stone-400">{policy.ruleName}</p>
          </div>

          {needsCard ? (
            <div className="mt-4">
              <label className="block">
                <span className="mb-1.5 block text-sm text-stone-600">
                  Card (nu se reține nimic acum)
                </span>
                <input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-mono tracking-wider outline-none focus:border-stone-900"
                />
              </label>
              <p className="mt-1.5 text-xs text-stone-400">
                Demo: 4242… reușește · 4000…0002 refuzat · 4000…9995 fonduri
                insuficiente
              </p>
            </div>
          ) : null}

          <label className="mt-4 flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-stone-900"
            />
            <span className="text-sm text-stone-600">
              Am citit și accept condițiile de mai sus.
            </span>
          </label>

          <button
            type="button"
            onClick={confirm}
            disabled={pending || !accepted || !cardOk}
            className="mt-5 w-full rounded-lg bg-stone-900 px-4 py-3.5 font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
          >
            {pending ? "Se confirmă…" : "Confirmă rezervarea"}
          </button>
        </Section>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-600">
          {step}
        </span>
        <h2 className="font-medium text-stone-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Confirmed({
  confirmation,
  timezone,
}: {
  confirmation: Confirmation;
  timezone: string;
}) {
  const when = new Intl.DateTimeFormat("ro-RO", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(confirmation.startAt));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
        ✓
      </div>
      <h2 className="mt-4 font-serif text-2xl text-stone-900">Rezervare confirmată</h2>
      <p className="mt-1 text-stone-600">{when}</p>

      <p className="mt-6 font-mono text-lg tracking-widest text-stone-900">
        {confirmation.reference}
      </p>
      <p className="mt-1 text-xs text-stone-400">Cod rezervare</p>

      {confirmation.cardLast4 ? (
        <p className="mt-6 border-t border-stone-100 pt-5 text-sm text-stone-500">
          Card •••• {confirmation.cardLast4} salvat. Nu s-a reținut nimic.
        </p>
      ) : (
        <p className="mt-6 border-t border-stone-100 pt-5 text-sm text-stone-500">
          Fără card — sunteți client cunoscut.
        </p>
      )}

      <p className="mt-4 text-sm text-stone-500">
        La sosire, scanați codul QR de la intrare.
      </p>
    </div>
  );
}
