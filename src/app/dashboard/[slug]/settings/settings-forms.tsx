"use client";

import { useActionState, useState } from "react";

import { btn, field } from "@/components/ui";
import { DISPUTE_WINDOW_DAYS } from "@/lib/constants";
import {
  CATEGORIES,
  COUNTIES,
  DESCRIPTION_MAX,
  PRICE_LEVELS,
  WEEK,
  isValidCui,
  type Interval,
  type WeekHours,
} from "@/lib/business-profile";
import {
  type SaveState,
  saveCompany,
  saveHours,
  saveProfile,
  saveRules,
  saveTables,
  setPublished,
} from "./actions";

type Props = {
  slug: string;
  published: boolean;
  missing: string[];
  profile: Record<
    "name" | "category" | "description" | "phone" | "email" | "website" | "address" | "city" | "county" | "postalCode" | "priceLevel",
    string
  >;
  hours: WeekHours;
  company: { legalName: string; taxId: string; tradeRegisterNo: string; registeredAddress: string; vatPayer: boolean };
  tables: { id?: string; name: string; capacity: number }[];
  rules: {
    gracePeriodMin: number;
    noShowFeeLei: number;
    cancellationWindowHours: number;
    durationMin: number;
    regularsEnabled: boolean;
    regularsAfter: number;
  };
  policy: { id: string; name: string; priority: number; enabled: boolean; outcome: string }[];
};

const SECTIONS = [
  { id: "profil", label: "Profil" },
  { id: "program", label: "Program" },
  { id: "firma", label: "Datele firmei" },
  { id: "mese", label: "Mese" },
  { id: "reguli", label: "Reguli" },
];

export function SettingsForms(props: Props) {
  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
      <aside className="min-w-0 lg:sticky lg:top-36 lg:self-start">
        <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-md px-3 py-2 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-blue transition hover:bg-blue hover:text-paper">
              {s.label}
            </a>
          ))}
        </nav>
        <PublishCard slug={props.slug} published={props.published} missing={props.missing} />
      </aside>

      <div className="min-w-0 space-y-6">
        <ProfileForm slug={props.slug} profile={props.profile} />
        <HoursForm slug={props.slug} initial={props.hours} />
        <CompanyForm slug={props.slug} company={props.company} />
        <TablesForm slug={props.slug} initial={props.tables} />
        <RulesForm slug={props.slug} rules={props.rules} policy={props.policy} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Panel({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-36 rounded-lg border-2 border-blue bg-sheet p-6 sm:p-8">
      <h2 className="text-2xl font-bold tracking-[-0.03em] text-blue">{title}</h2>
      <p className="mt-1 text-sm text-muted">{lead}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SaveBar({ state, pending, label = "Salvează" }: { state: SaveState; pending: boolean; label?: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 border-t-2 border-dashed border-blue/30 pt-5">
      <button type="submit" disabled={pending} className={btn.primary}>
        {pending ? "Se salvează…" : label}
      </button>
      {state?.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : state?.ok ? (
        <p role="status" className="text-sm text-emerald-700">
          ✓ {state.message}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={field.label}>{label}</span>
      {children}
      {hint ? <span className={`block ${field.hint}`}>{hint}</span> : null}
    </label>
  );
}

// ---------------------------------------------------------------------------

function PublishCard({ slug, published, missing }: { slug: string; published: boolean; missing: string[] }) {
  const [state, action, pending] = useActionState(setPublished, undefined);
  return (
    <form action={action} className="mt-4 rounded-lg border-2 border-blue bg-sheet p-5 lg:mt-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="publish" value={published ? "0" : "1"} />
      <p className="flex items-center gap-2 text-sm font-medium">
        <span className={`h-2 w-2 rounded-full ${published ? "bg-emerald-500" : "bg-amber-500"}`} />
        {published ? "Publicat în căutare" : "Nepublicat"}
      </p>
      {missing.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {missing.map((m) => (
            <li key={m}>○ {m}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">{published ? "Clienții te găsesc pe pagina Restaurante." : "Totul e completat."}</p>
      )}
      <button
        type="submit"
        disabled={pending || (!published && missing.length > 0)}
        className={`${published ? btn.small : btn.accent} mt-4 w-full ${published ? "" : "py-2.5"}`}
      >
        {pending ? "…" : published ? "Retrage din căutare" : "Publică restaurantul"}
      </button>
      {state?.error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="mt-2 text-xs text-emerald-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------

function ProfileForm({ slug, profile }: { slug: string; profile: Props["profile"] }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  const [description, setDescription] = useState(profile.description);

  return (
    <Panel id="profil" title="Profil public" lead="Aceleași câmpuri ca pe Google Business Profile — le poți copia unul câte unul.">
      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Numele afacerii" className="sm:col-span-2">
            <input name="name" defaultValue={profile.name} required className={field.input} />
          </Field>
          <Field label="Categoria principală">
            <select name="category" defaultValue={profile.category} required className={field.input}>
              <option value="" disabled>
                Alege…
              </option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Interval de preț" hint="Per persoană.">
            <select name="priceLevel" defaultValue={profile.priceLevel} className={field.input}>
              <option value="">Nespecificat</option>
              {PRICE_LEVELS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Descriere"
            className="sm:col-span-2"
            hint={`${description.length}/${DESCRIPTION_MAX} caractere`}
          >
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
              rows={4}
              placeholder="Ce vă face speciali, în câteva fraze."
              className={field.input}
            />
          </Field>
        </div>

        <p className="mt-8 text-sm font-semibold">Contact</p>
        <div className="mt-3 grid gap-5 sm:grid-cols-3">
          <Field label="Telefon">
            <input name="phone" defaultValue={profile.phone} inputMode="tel" required placeholder="+40 721 000 000" className={field.input} />
          </Field>
          <Field label="Site web">
            <input name="website" defaultValue={profile.website} inputMode="url" placeholder="www.restaurant.ro" className={field.input} />
          </Field>
          <Field label="E-mail pentru rezervări">
            <input name="email" type="email" defaultValue={profile.email} className={field.input} />
          </Field>
        </div>

        <p className="mt-8 text-sm font-semibold">Adresă</p>
        <div className="mt-3 grid gap-5 sm:grid-cols-6">
          <Field label="Stradă și număr" className="sm:col-span-6">
            <input name="address" defaultValue={profile.address} required autoComplete="street-address" className={field.input} />
          </Field>
          <Field label="Localitate" className="sm:col-span-2">
            <input name="city" defaultValue={profile.city} required autoComplete="address-level2" className={field.input} />
          </Field>
          <Field label="Județ" className="sm:col-span-2">
            <select name="county" defaultValue={profile.county} required className={field.input}>
              <option value="" disabled>
                Alege…
              </option>
              {COUNTIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Cod poștal" className="sm:col-span-2">
            <input name="postalCode" defaultValue={profile.postalCode} inputMode="numeric" maxLength={6} className={field.input} />
          </Field>
        </div>

        <SaveBar state={state} pending={pending} />
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function HoursForm({ slug, initial }: { slug: string; initial: WeekHours }) {
  const [state, action, pending] = useActionState(saveHours, undefined);
  const [hours, setHours] = useState<WeekHours>(initial);

  const setDay = (weekday: number, next: Interval[]) => setHours((h) => ({ ...h, [weekday]: next }));

  return (
    <Panel id="program" title="Program" lead="Ca pe Google: poți avea mai multe intervale pe zi. O oră de închidere după miezul nopții e în regulă.">
      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="hours" value={JSON.stringify(hours)} />
        <ul className="divide-y-2 divide-dashed divide-blue/15">
          {WEEK.map(({ weekday, label }) => {
            const day = hours[weekday] ?? [];
            const open = day.length > 0;
            return (
              <li key={weekday} className="grid gap-3 py-4 sm:grid-cols-[9rem_1fr] sm:items-start">
                <label className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) => setDay(weekday, e.target.checked ? [{ open: "12:00", close: "23:00" }] : [])}
                    className="h-4 w-4 accent-pink"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
                {open ? (
                  <div className="space-y-2">
                    {day.map((iv, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          value={iv.open}
                          onChange={(e) => setDay(weekday, day.map((d, j) => (j === i ? { ...d, open: e.target.value } : d)))}
                          className={`${field.input} w-32`}
                          aria-label={`${label}: deschidere`}
                        />
                        <span className="text-faint">–</span>
                        <input
                          type="time"
                          value={iv.close}
                          onChange={(e) => setDay(weekday, day.map((d, j) => (j === i ? { ...d, close: e.target.value } : d)))}
                          className={`${field.input} w-32`}
                          aria-label={`${label}: închidere`}
                        />
                        {day.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setDay(weekday, day.filter((_, j) => j !== i))}
                            className="rounded-full px-2 py-1 text-sm text-muted hover:text-red-700"
                            aria-label="Șterge intervalul"
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {day.length < 3 ? (
                      <button
                        type="button"
                        onClick={() => setDay(weekday, [...day, { open: "18:00", close: "23:00" }])}
                        className="text-sm text-pink-deep hover:underline"
                      >
                        + Adaugă interval
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="pt-2 text-sm text-faint">Închis</p>
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => {
            const mon = hours[1] ?? [];
            setHours(Object.fromEntries(WEEK.map(({ weekday }) => [weekday, mon.map((iv) => ({ ...iv }))])));
          }}
          className={`${btn.small} mt-3`}
        >
          Copiază programul de luni pe toată săptămâna
        </button>
        <SaveBar state={state} pending={pending} />
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function CompanyForm({ slug, company }: { slug: string; company: Props["company"] }) {
  const [state, action, pending] = useActionState(saveCompany, undefined);
  const [cui, setCui] = useState(company.taxId);
  const cuiState = cui.trim().length < 2 ? null : isValidCui(cui);

  return (
    <Panel
      id="firma"
      title="Datele firmei"
      lead="Apar pe chitanța oricărei taxe încasate și sunt cerute de procesatorul de plăți. Nu sunt afișate public în căutare."
    >
      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Denumire legală" hint="Exact ca în certificatul de înregistrare." className="sm:col-span-2">
            <input name="legalName" defaultValue={company.legalName} required placeholder="Hanul cu Tei S.R.L." className={field.input} />
          </Field>
          <Field
            label="CUI / CIF"
            hint={
              cuiState === null ? (
                "Cu sau fără prefixul RO."
              ) : cuiState ? (
                <span className="text-emerald-700">✓ Cifra de control e corectă.</span>
              ) : (
                <span className="text-red-700">Cifra de control nu se potrivește.</span>
              )
            }
          >
            <input
              name="taxId"
              value={cui}
              onChange={(e) => setCui(e.target.value)}
              required
              inputMode="numeric"
              placeholder="RO12345678"
              className={`${field.input} font-mono`}
            />
          </Field>
          <Field label="Nr. Reg. Com." hint="Ex. J40/1234/2020 sau J2020001234409.">
            <input
              name="tradeRegisterNo"
              defaultValue={company.tradeRegisterNo}
              required
              placeholder="J40/1234/2020"
              className={`${field.input} font-mono uppercase`}
            />
          </Field>
          <Field label="Sediu social" className="sm:col-span-2">
            <input name="registeredAddress" defaultValue={company.registeredAddress} required className={field.input} />
          </Field>
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm">
          <input name="vatPayer" type="checkbox" defaultChecked={company.vatPayer} className="h-4 w-4 accent-pink" />
          Firma este plătitoare de TVA
        </label>
        <SaveBar state={state} pending={pending} />
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function TablesForm({ slug, initial }: { slug: string; initial: Props["tables"] }) {
  const [state, action, pending] = useActionState(saveTables, undefined);
  const [tables, setTables] = useState(initial);
  const seats = tables.reduce((s, t) => s + (Number(t.capacity) || 0), 0);

  const nextName = () => {
    const used = new Set(tables.map((t) => t.name.toLowerCase()));
    let n = tables.length + 1;
    while (used.has(`m${n}`)) n += 1;
    return `M${n}`;
  };

  return (
    <Panel id="mese" title="Mese" lead="Fiecare masă cu numărul de locuri. Clienții văd doar orele în care încape grupul lor.">
      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="tables" value={JSON.stringify(tables)} />
        {tables.length === 0 ? (
          <p className="rounded-md border border-dashed border-blue/25 p-6 text-center text-sm text-muted">
            Nicio masă încă. Adaugă-le mai jos.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {tables.map((t, i) => (
              <li key={t.id ?? `new-${i}`} className="flex items-center gap-2 rounded-md border-2 border-blue/25 p-2 pl-3">
                <input
                  value={t.name}
                  onChange={(e) => setTables(tables.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="w-full min-w-0 bg-transparent font-medium outline-none"
                  aria-label="Numele mesei"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTables(tables.map((x, j) => (j === i ? { ...x, capacity: Math.max(1, x.capacity - 1) } : x)))}
                    className="h-8 w-8 rounded-full border-2 border-blue/25 text-muted hover:text-ink"
                    aria-label="Mai puține locuri"
                  >
                    −
                  </button>
                  <span className="w-14 text-center text-sm tabular-nums">{t.capacity} loc.</span>
                  <button
                    type="button"
                    onClick={() => setTables(tables.map((x, j) => (j === i ? { ...x, capacity: Math.min(30, x.capacity + 1) } : x)))}
                    className="h-8 w-8 rounded-full border-2 border-blue/25 text-muted hover:text-ink"
                    aria-label="Mai multe locuri"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setTables(tables.filter((_, j) => j !== i))}
                  className="h-8 w-8 rounded-full text-muted hover:bg-red-50 hover:text-red-700"
                  aria-label={`Șterge ${t.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[2, 4, 6].map((cap) => (
            <button
              key={cap}
              type="button"
              onClick={() => setTables([...tables, { name: nextName(), capacity: cap }])}
              className={btn.small}
            >
              + Masă de {cap}
            </button>
          ))}
          <span className="ml-auto text-sm text-muted">
            {tables.length} mese · {seats} locuri
          </span>
        </div>
        <SaveBar state={state} pending={pending} />
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function RulesForm({ slug, rules, policy }: { slug: string; rules: Props["rules"]; policy: Props["policy"] }) {
  const [state, action, pending] = useActionState(saveRules, undefined);
  const [grace, setGrace] = useState(rules.gracePeriodMin);
  const [fee, setFee] = useState(rules.noShowFeeLei);

  const at = (min: number) => {
    const t = 20 * 60 + min;
    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };

  return (
    <Panel id="reguli" title="Reguli de rezervare" lead="Ce vede clientul înainte să confirme. Modificările se aplică doar rezervărilor noi.">
      <form action={action}>
        <input type="hidden" name="slug" value={slug} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Perioadă de toleranță (minute)" hint="Singura întârziere acceptată. După ea, masa se eliberează pentru alți clienți și neprezentarea se înregistrează automat.">
            <input name="gracePeriodMin" type="number" min={5} max={60} value={grace} onChange={(e) => setGrace(Number(e.target.value))} className={field.input} />
          </Field>
          <Field label="Taxă de neprezentare (lei)" hint="Implicită. Grupurile mari și cei care au mai lipsit au reguli separate, mai jos.">
            <input name="noShowFeeLei" type="number" min={10} max={2000} value={fee} onChange={(e) => setFee(Number(e.target.value))} className={field.input} />
          </Field>
          <Field label="Anulare gratuită până la (ore înainte)">
            <input name="cancellationWindowHours" type="number" min={0} max={168} defaultValue={rules.cancellationWindowHours} className={field.input} />
          </Field>
          <Field label="Durata unei mese (minute)">
            <select name="durationMin" defaultValue={rules.durationMin} className={field.input}>
              {[60, 90, 120, 150, 180, 240].map((m) => (
                <option key={m} value={m}>
                  {m >= 60 ? `${m / 60} h`.replace(".5 h", " h 30") : `${m} min`}
                </option>
              ))}
            </select>
          </Field>
          <div className="rounded-md border-2 border-blue/30 bg-blue-soft p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input name="regularsEnabled" type="checkbox" defaultChecked={rules.regularsEnabled} className="h-4 w-4 accent-pink" />
              Clienții fideli rezervă fără card
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-muted">
              după
              <input name="regularsAfter" type="number" min={1} max={50} defaultValue={rules.regularsAfter} className="w-16 rounded-lg border-2 border-blue bg-sheet px-2 py-1 text-ink" />
              vizite onorate
            </label>
          </div>
        </div>

        <div className="mt-6 rounded-md border-2 border-blue/25 p-4 text-sm">
          <p className="font-medium">Cum arată pentru o rezervare la 20:00</p>
          <p className="mt-2 text-muted">
            Masa e ținută până la <b className="text-ink">{at(grace)}</b>. Dacă sosirea nu e confirmată până atunci, masa se
            eliberează pentru alți clienți, se înregistrează neprezentarea și poți încasa <b className="text-ink">{fee} lei</b>. Banii
            ajung la tine după {DISPUTE_WINDOW_DAYS} zile, dacă clientul nu contestă.
          </p>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium">Toate regulile, în ordinea aplicării</p>
          <p className="mt-1 text-xs text-muted">Prima regulă care se potrivește clientului decide ce i se cere.</p>
          <ol className="mt-3 divide-y divide-blue/15 rounded-md border-2 border-blue/25">
            {policy.map((r) => (
              <li key={r.id} className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${r.enabled ? "" : "opacity-40"}`}>
                <span>
                  <span className="mr-2 font-mono text-xs text-faint">{r.priority}</span>
                  {r.name}
                </span>
                <span className="shrink-0 text-muted">{r.enabled ? r.outcome : "dezactivată"}</span>
              </li>
            ))}
          </ol>
        </div>

        <SaveBar state={state} pending={pending} />
      </form>
    </Panel>
  );
}
