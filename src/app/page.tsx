import Link from "next/link";

import { Mark } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { btn, label } from "@/components/ui";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Ticker />
        <Score />
        <ForClients />
        <ForRestaurants />
        <Fairness />
        <Faq />
        <LegalShelf />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden border-b-2 border-blue">
      <div aria-hidden="true" className="halftone-pink halftone-fade pointer-events-none absolute -right-24 -top-10 h-[34rem] w-[46rem] opacity-60" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24">
        <div className="rise">
          <p className={`${label} inline-flex items-center gap-2 rounded-md border-2 border-blue bg-sheet px-2.5 py-1 text-blue`}>
            <span className="live-dot h-2 w-2 rounded-full bg-pink" />
            Rezervări pentru restaurante · România
          </p>
          <h1 className="mt-7 text-[3.4rem] font-bold leading-[0.9] tracking-[-0.055em] text-blue sm:text-[5.6rem] lg:text-[6.4rem]">
            Masa e{" "}
            <span className="overprint" data-text="ținută.">
              ținută.
            </span>
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink">
            Clientul rezervă în 30 de secunde, fără cont și fără aplicație. Nu plătește nimic ca să rezerve —
            cardul e taxat doar dacă nu vine. Iar clienții fideli nu lasă card deloc.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/restaurants" className={`${btn.primary} px-6 py-3 text-base`}>
              Caută un restaurant →
            </Link>
            <Link href="/register" className={`${btn.ghost} px-6 py-3 text-base`}>
              Am un restaurant
            </Link>
          </div>
        </div>

        <Ticket />
      </div>
    </section>
  );
}

/** The reservation as a printed, stamped ticket. */
function Ticket() {
  return (
    <div className="rise relative mx-auto w-full max-w-sm [animation-delay:150ms]" aria-hidden="true">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-lg bg-blue" />
      <div className="perforated relative rounded-lg border-2 border-blue bg-sheet">
        <div className="px-6 pb-5 pt-8">
          <div className="flex items-start justify-between">
            <p className={`${label} text-blue`}>Rezervare · Nr. 0427</p>
            <Mark className="h-7 w-7" />
          </div>
          <p className="mt-4 text-3xl font-bold leading-none tracking-[-0.04em] text-blue">Hanul cu Tei</p>
          <p className="mt-2 text-sm text-muted">Str. Lipscani 12, București</p>
        </div>

        <div className="grid grid-cols-3 border-y-2 border-dashed border-blue/40 text-center">
          <TicketCell k="Vineri" v="3 oct" />
          <TicketCell k="Ora" v="20:00" mid />
          <TicketCell k="Pers." v="4" />
        </div>

        <div className="relative px-6 pb-8 pt-5">
          <p className={`${label} text-muted`}>La sosire</p>
          <p className="mt-1 text-[15px] leading-snug text-ink">Arată codul QR din SMS. Atât.</p>
          <p className={`${label} mt-4 text-muted`}>Plătit la rezervare</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-blue">0 lei</p>

          <div
            className="stamp absolute -right-2 bottom-5 rounded-md border-[3px] border-pink px-3 py-2 text-center text-pink mix-blend-multiply [--r:-11deg]"
          >
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Masa</p>
            <p className="text-xl font-bold leading-none tracking-tight">ȚINUTĂ</p>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">15 minute</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketCell({ k, v, mid }: { k: string; v: string; mid?: boolean }) {
  return (
    <div className={`py-3.5 ${mid ? "border-x-2 border-dashed border-blue/40" : ""}`}>
      <p className={`${label} text-muted`}>{k}</p>
      <p className="mt-0.5 text-xl font-bold tracking-tight text-blue">{v}</p>
    </div>
  );
}

function Ticker() {
  const items = [
    "0 lei la rezervare",
    "fără aplicație",
    "fără cont",
    "masa ținută 15 minute",
    "clienții fideli fără card",
    "nimeni nu e taxat pe cuvânt",
    "7 zile ca să contești o taxă",
  ];
  const run = [...items, ...items];
  return (
    <div className="overflow-hidden border-b-2 border-blue bg-blue py-3.5 text-paper" aria-label={items.join(", ")}>
      <div className="animate-marquee flex w-max gap-8 whitespace-nowrap" aria-hidden="true">
        {run.map((t, i) => (
          <span key={i} className="flex items-center gap-8 font-mono text-sm font-semibold uppercase tracking-[0.16em]">
            {t}
            <span className="text-pink">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The evening, as a score
// ---------------------------------------------------------------------------

function Score() {
  const bars = [
    { t: "20:00", title: "Ora rezervării", body: "Masa e pregătită, pe numele tău." },
    { t: "20:00 → 20:15", title: "Toleranța", body: "Singura întârziere, stabilită de restaurant și afișată înainte să rezervi. Masa e ținută — garantat." },
    { t: "20:15", title: "Masa se eliberează", body: "N-ai ajuns? Masa trece la alți clienți, iar restaurantul poate încasa suma pe care ai acceptat-o — o singură dată." },
    { t: "7 zile", title: "Poți contesta", body: "Banii stau blocați 7 zile. Contești cu un tap și nu ajung la restaurant până nu se rezolvă." },
  ];
  return (
    <section className="border-b-2 border-blue">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div>
            <p className={`${label} text-pink-deep`}>Partitura unei seri</p>
            <h2 className="mt-3 text-4xl font-bold leading-[0.95] tracking-[-0.045em] text-blue sm:text-6xl">
              Tenuto: nota ținută pe toată durata ei.
            </h2>
          </div>
          <p className="max-w-md text-lg leading-relaxed text-ink lg:justify-self-end">
            În muzică, liniuța de deasupra unei note înseamnă „ține-o întreagă”. La noi, e masa ta — ținută exact cât a
            promis restaurantul, nici mai mult, nici mai puțin. Iată cum curge o rezervare de la 20:00.
          </p>
        </div>

        <div className="mt-14 rounded-lg border-2 border-blue bg-sheet p-4 shadow-[var(--shadow-print-lg)] sm:p-8">
          <Staff />
          <ol className="mt-6 grid gap-6 border-t-2 border-dashed border-blue/30 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {bars.map((b, i) => (
              <li key={b.t}>
                <p className="font-mono text-xs font-bold text-pink-deep">
                  {String(i + 1).padStart(2, "0")} · {b.t}
                </p>
                <p className="mt-2 text-lg font-bold tracking-tight text-blue">{b.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{b.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** Four measures on a staff. Decorative; the list below carries the meaning. */
function Staff() {
  const lines = [60, 80, 100, 120, 140];
  return (
    <svg viewBox="0 0 1000 200" className="h-auto w-full" aria-hidden="true">
      {/* measure 2: the grace, a pink halftone band */}
      <defs>
        <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2" fill="var(--color-pink)" />
        </pattern>
      </defs>
      <rect x="252" y="52" width="216" height="96" fill="url(#dots)" opacity="0.55" />
      <rect x="472" y="52" width="306" height="96" fill="var(--color-pink)" opacity="0.14" />

      {lines.map((y) => (
        <line key={y} x1="20" x2="980" y1={y} y2={y} stroke="var(--color-blue)" strokeWidth="2" />
      ))}
      {[20, 250, 470, 780].map((x) => (
        <line key={x} x1={x} x2={x} y1="60" y2="140" stroke="var(--color-blue)" strokeWidth="2.5" />
      ))}
      {/* final double bar */}
      <line x1="966" x2="966" y1="60" y2="140" stroke="var(--color-blue)" strokeWidth="2.5" />
      <rect x="972" y="60" width="8" height="80" fill="var(--color-blue)" />

      {/* measure 1: the booking — a note with its tenuto bar */}
      <g style={{ mixBlendMode: "multiply" }}>
        <rect className="hold" x="104" y="34" width="46" height="8" rx="1.5" fill="var(--color-pink)" />
      </g>
      <ellipse cx="128" cy="110" rx="17" ry="12" transform="rotate(-22 128 110)" fill="var(--color-blue)" />
      <line x1="143" x2="143" y1="106" y2="52" stroke="var(--color-blue)" strokeWidth="3" />

      {/* measure 2: a whole note, held, tied across */}
      <ellipse cx="300" cy="100" rx="19" ry="12" transform="rotate(-22 300 100)" fill="none" stroke="var(--color-blue)" strokeWidth="6" />
      <path d="M300 82 Q 360 40 430 82" fill="none" stroke="var(--color-blue)" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="430" cy="100" rx="19" ry="12" transform="rotate(-22 430 100)" fill="none" stroke="var(--color-blue)" strokeWidth="6" />

      {/* measure 3: a rest under a fermata — the pause you can still end */}
      <rect x="604" y="80" width="40" height="13" fill="var(--color-blue)" />
      <path d="M592 46 Q 624 18 656 46" fill="none" stroke="var(--color-pink)" strokeWidth="5" strokeLinecap="round" style={{ mixBlendMode: "multiply" }} />
      <circle cx="624" cy="40" r="4.5" fill="var(--color-pink)" />

      {/* measure 4: the accent — only now */}
      <ellipse cx="872" cy="120" rx="17" ry="12" transform="rotate(-22 872 120)" fill="var(--color-blue)" />
      <line x1="887" x2="887" y1="116" y2="62" stroke="var(--color-blue)" strokeWidth="3" />
      <path d="M846 170 l40 -8 -40 -8" fill="none" stroke="var(--color-pink)" strokeWidth="4" strokeLinejoin="round" />

      {/* time marks */}
      {[
        [250, "20:00"],
        [470, "20:15"],
        [780, "+7 zile"],
      ].map(([x, t]) => (
        <text key={`${x}`} x={Number(x) + 6} y="186" fontFamily="var(--font-overpass-mono)" fontSize="15" fontWeight="700" fill="var(--color-blue)">
          {t}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

function ForClients() {
  const steps = [
    { n: "1", title: "Alegi", body: "Caută după nume sau oraș, ori deschide linkul primit de la restaurant." },
    { n: "2", title: "Rezervi", body: "Câte persoane, ce zi, ce oră, pe ce nume. Vezi doar orele cu adevărat libere." },
    { n: "3", title: "Citești", body: "Dacă se cere card, cât și când — înainte să confirmi. Nu se reține nimic." },
    { n: "4", title: "Ajungi", body: "Primești un SMS cu adresa și un cod QR. La intrare îl scanează personalul — sau îți spui numele." },
  ];
  return (
    <section id="cum-functioneaza" className="scroll-mt-20 border-b-2 border-blue bg-sheet">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <p className={`${label} text-pink-deep`}>Pentru clienți</p>
        <h2 className="mt-3 max-w-3xl text-4xl font-bold leading-[0.95] tracking-[-0.045em] text-blue sm:text-6xl">
          Un client bun nici nu observă că suntem aici.
        </h2>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-lg border-2 border-blue bg-blue sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="group relative bg-sheet p-6 transition-colors hover:bg-pink-soft">
              <span className="overprint text-7xl font-bold leading-none tracking-[-0.06em]" data-text={s.n}>
                {s.n}
              </span>
              <h3 className="mt-6 text-2xl font-bold tracking-tight text-blue">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Persona tag="Client fidel" tone="bg-emerald-500" quote="Ești client cunoscut — nu cerem card. Masa e ținută 15 minute." />
          <Persona tag="Client nou" tone="bg-blue" quote="Nu se reține nimic acum. Dacă nu ajungi sau anulezi târziu: 50 lei." />
          <Persona tag="A mai lipsit" tone="bg-pink" quote="Restaurantul poate cere o garanție mai mare. O vezi înainte să confirmi." />
        </div>
      </div>
    </section>
  );
}

function Persona({ tag, tone, quote }: { tag: string; tone: string; quote: string }) {
  return (
    <figure className="rounded-lg border-2 border-blue bg-paper p-5">
      <figcaption className={`${label} flex items-center gap-2 text-blue`}>
        <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
        {tag}
      </figcaption>
      <blockquote className="mt-3 text-[15px] leading-relaxed text-ink">„{quote}”</blockquote>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Restaurants
// ---------------------------------------------------------------------------

function ForRestaurants() {
  const menu = [
    ["Regulile tale, per client", "Fideli fără card, noi cu garanție, cei care au lipsit cu avans. Prima regulă potrivită câștigă."],
    ["Link și cod QR de rezervare", "Pe Instagram, pe Google, pe meniu. Clienții rezervă direct la tine."],
    ["Sosiri dintr-o scanare", "Clientul arată codul QR din SMS; îl scanezi cu camera și confirmi. Sau cauți „pe ce nume?”."],
    ["Masa nu stă goală", "La finalul toleranței, masa se eliberează pentru alți clienți, iar neprezentarea se marchează singură."],
    ["Încasare cu un buton", "Doar neprezentările de după toleranță, o singură dată fiecare. Banii ajung la tine după 7 zile."],
    ["Bani recuperați, la vedere", "Cât ai recuperat și din câte neprezentări. Cifra care își plătește abonamentul."],
  ];
  return (
    <section id="pentru-restaurante" className="scroll-mt-20 border-b-2 border-blue">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className={`${label} text-pink-deep`}>Pentru restaurante</p>
            <h2 className="mt-3 text-4xl font-bold leading-[0.95] tracking-[-0.045em] text-blue sm:text-6xl">
              Te protejezi de cei 10% care nu vin.{" "}
              <span className="overprint" data-text="Fără">
                Fără
              </span>{" "}
              să-ți sperii fidelii.
            </h2>
          </div>
          <Link href="/register" className={`${btn.primary} px-6 py-3 text-base`}>
            Începe gratuit →
          </Link>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <HostStand />

          {/* The feature list, set like the menu it serves. */}
          <div className="rounded-lg border-2 border-blue bg-sheet p-6 sm:p-8">
            <div className="flex items-baseline justify-between border-b-2 border-blue pb-3">
              <p className="text-2xl font-bold tracking-tight text-blue">Meniul casei</p>
              <p className={`${label} text-muted`}>toate incluse</p>
            </div>
            <ul className="mt-2">
              {menu.map(([name, desc]) => (
                <li key={name} className="border-b border-dashed border-blue/30 py-4 last:border-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-blue">{name}</span>
                    <span className="mb-1 flex-1 border-b-2 border-dotted border-blue/40" />
                    <span className="font-mono text-xs font-bold uppercase text-pink-deep">inclus</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The dashboard, as the host sees it at 20:18 on a Friday. */
function HostStand() {
  const rows = [
    { t: "19:30", name: "Radu G.", p: 2, state: "absent" as const },
    { t: "20:00", name: "Andreea P.", p: 2, state: "in" as const },
    { t: "20:00", name: "Mihai Ionescu", p: 4, state: "match" as const },
    { t: "20:30", name: "Elena M.", p: 6, state: "wait" as const },
  ];
  return (
    <div className="relative lg:self-start" aria-hidden="true">
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-lg bg-pink" />
      <div className="relative overflow-hidden rounded-lg border-2 border-blue bg-sheet">
        <div className="flex items-center justify-between border-b-2 border-blue bg-blue px-5 py-3 text-paper">
          <p className="font-bold tracking-tight">Seara de azi</p>
          <p className="font-mono text-xs">VIN · 20:18</p>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 rounded-md border-2 border-blue bg-paper px-3 py-2.5 shadow-[3px_3px_0_var(--color-pink)]">
            <span className="text-blue">⌕</span>
            <span className="text-ink">mih</span>
            <span className="live-dot -ml-2 h-5 w-0.5 bg-blue" />
            <span className={`${label} ml-auto text-faint`}>pe ce nume?</span>
          </div>
          <ul className="mt-4 divide-y-2 divide-dashed divide-blue/20">
            {rows.map((r) => (
              <li key={r.name} className={`flex items-center gap-3 py-3 ${r.state === "match" ? "-mx-2 rounded-md bg-pink-soft px-2" : ""}`}>
                <span className="w-12 font-mono text-sm font-bold text-blue">{r.t}</span>
                <span className="flex-1 text-[15px] font-semibold text-ink">
                  {r.name} <span className="font-normal text-faint">· {r.p}</span>
                </span>
                {r.state === "in" ? (
                  <span className="rounded-md bg-emerald-100 px-2 py-1 font-mono text-[11px] font-bold uppercase text-emerald-800">Sosit ✓</span>
                ) : r.state === "absent" ? (
                  <span className="rounded-md bg-amber-100 px-2 py-1 font-mono text-[11px] font-bold uppercase text-amber-900">Absent · 1h 42</span>
                ) : r.state === "match" ? (
                  <span className="rounded-md border-2 border-blue bg-pink px-3 py-1 text-sm font-bold text-ink shadow-[2px_2px_0_var(--color-blue)]">A sosit</span>
                ) : (
                  <span className="rounded-md bg-blue-soft px-2 py-1 font-mono text-[11px] font-bold uppercase text-blue">Așteptat</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-between border-t-2 border-blue bg-paper px-5 py-3">
          <p className="text-sm text-ink">
            <b className="text-blue">1 scadentă</b> · 50 lei
          </p>
          <span className="rounded-md border-2 border-blue bg-pink px-3 py-1 text-sm font-bold text-ink">Încasează</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fairness, FAQ, legal
// ---------------------------------------------------------------------------

function Fairness() {
  const rules = [
    ["Să te taxeze pe cuvânt.", "Neprezentarea o înregistrează sistemul, la minut, la finalul toleranței — nu restaurantul."],
    ["Să te marcheze absent mai devreme.", "Toleranța e impusă de cod. Nu e o promisiune, e o regulă."],
    ["Să păstreze banii pe care îi contești.", "Taxa stă blocată 7 zile. Contești cu un tap, iar restaurantul nu o primește până nu decide Tenuto."],
    ["Să schimbe ce ai acceptat.", "Textul exact pe care l-ai văzut e salvat și nu mai poate fi atins de nimeni."],
  ];
  return (
    <section className="border-b-2 border-blue bg-blue text-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <p className={`${label} text-pink-soft`}>Corect pentru ambele părți</p>
        <h2 className="mt-3 max-w-3xl text-4xl font-bold leading-[0.95] tracking-[-0.045em] sm:text-6xl">
          Ce nu poate face un restaurant. Niciodată.
        </h2>
        <ul className="mt-14 grid gap-4 sm:grid-cols-2">
          {rules.map(([t, d], i) => (
            <li key={t} className="relative rounded-lg border-2 border-paper/30 p-6">
              <span
                className="absolute -top-4 right-5 rounded-md border-[3px] border-pink bg-blue px-2 py-0.5 text-lg font-bold text-pink"
                style={{ transform: `rotate(${i % 2 ? 6 : -5}deg)` }}
              >
                NU
              </span>
              <p className="text-xl font-bold tracking-tight">{t}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-paper/75">{d}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  const qa = [
    ["Plătesc ceva ca să rezerv?", "Nu. Niciodată. Dacă restaurantul cere un card, acesta e doar salvat ca garanție — nu se blochează nicio sumă."],
    ["Ce se întâmplă dacă întârzii?", "Masa e ținută pe durata toleranței afișate la rezervare. După aceea poate fi dată altor clienți — dacă știi că întârzii, sună restaurantul."],
    ["Cum anulez?", "Anularea în termenul afișat la rezervare e gratuită — anunță restaurantul. O anulare e mereu mai bună decât o neprezentare: masa ajunge la altcineva."],
    ["Cine vede datele mele de card?", "Nici restaurantul, nici Tenuto. Cardul e procesat de furnizorul de plăți; noi păstrăm doar tipul și ultimele patru cifre."],
    ["Pot contesta o taxă?", "Da, cu un tap, din pagina rezervării tale. Banii stau blocați 7 zile și nu ajung la restaurant până nu se rezolvă: restaurantul poate rambursa, altfel verifică Tenuto."],
    ["Trebuie să instalez o aplicație?", "Nu. Rezervi din browserul telefonului și primești un SMS cu linkul rezervării și codul QR pentru sosire."],
  ];
  return (
    <section className="border-b-2 border-blue">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className={`${label} text-pink-deep`}>Întrebări</p>
          <h2 className="mt-3 text-4xl font-bold leading-[0.95] tracking-[-0.045em] text-blue sm:text-6xl">Pe scurt.</h2>
        </div>
        <div className="border-t-2 border-blue">
          {qa.map(([q, a]) => (
            <details key={q} className="group border-b-2 border-blue py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-bold tracking-tight text-blue [&::-webkit-details-marker]:hidden">
                {q}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-blue text-xl leading-none transition group-open:rotate-45 group-open:bg-pink">
                  +
                </span>
              </summary>
              <p className="mt-3 pr-12 text-[15px] leading-relaxed text-ink">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function LegalShelf() {
  const docs = [
    { href: "/legal/termeni", title: "Termeni și condiții", body: "Client, restaurant, Tenuto." },
    { href: "/legal/politica-neprezentare", title: "Neprezentare", body: "Când și cum se poate percepe o taxă." },
    { href: "/legal/confidentialitate", title: "Confidențialitate", body: "Ce date folosim și de ce." },
    { href: "/legal/cookies", title: "Cookie-uri", body: "Doar unul, strict necesar." },
  ];
  return (
    <section id="legal" className="scroll-mt-20 border-b-2 border-blue bg-sheet">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-bold tracking-[-0.04em] text-blue sm:text-4xl">Totul scris. Fără litere mici.</h2>
          <Link href="/legal" className="font-semibold text-blue underline decoration-pink decoration-2 underline-offset-4">
            Toate documentele →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {docs.map((d, i) => (
            <Link
              key={d.href}
              href={d.href}
              className="press group block rounded-lg border-2 border-blue bg-paper p-5"
            >
              <p className="font-mono text-xs font-bold text-pink-deep">§ {i + 1}</p>
              <p className="mt-3 text-lg font-bold tracking-tight text-blue">{d.title}</p>
              <p className="mt-1 text-sm text-muted">{d.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-pink">
      <div aria-hidden="true" className="halftone-blue pointer-events-none absolute -bottom-10 -left-10 h-72 w-[40rem] opacity-25 [mask-image:linear-gradient(20deg,#000,transparent_70%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-24 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="max-w-3xl text-5xl font-bold leading-[0.9] tracking-[-0.055em] text-ink sm:text-7xl">
          Nicio masă goală cu „rezervat” pe ea.
        </h2>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/register"
            className="press inline-flex items-center justify-center whitespace-nowrap rounded-md border-2 border-blue bg-sheet px-6 py-3.5 text-base font-bold text-blue"
          >
            Înregistrează-ți restaurantul →
          </Link>
          <Link href="/restaurants" className="inline-flex items-center justify-center px-2 py-3.5 font-semibold text-ink underline decoration-blue decoration-2 underline-offset-4">
            sau caută unde să mănânci
          </Link>
        </div>
      </div>
    </section>
  );
}
