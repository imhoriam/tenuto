/**
 * Business profile helpers. Pure — no database, no Next — so they test
 * without either.
 *
 * The public profile mirrors the fields of a Google Business Profile (name,
 * primary category, description, address, phone, website, hours, price range)
 * so an operator can copy theirs across field by field.
 */

import type { ResourceKind } from "./constants";

type Unit = { one: string; many: string; article: "un" | "o"; kind: ResourceKind };

type Vertical = {
  label: string;
  /** What is booked: a table seats a party; everything else is one customer. */
  unit: Unit;
  usesPartySize: boolean;
  categories: readonly string[];
};

/** Google-style categories, grouped by what the business actually rents out. */
export const VERTICALS = {
  restaurant: {
    label: "Restaurante, cafenele și baruri",
    unit: { one: "masă", many: "mese", article: "o", kind: "table" },
    usesPartySize: true,
    categories: [
      "Restaurant",
      "Restaurant românesc",
      "Restaurant italian",
      "Restaurant mediteranean",
      "Restaurant grecesc",
      "Restaurant francez",
      "Restaurant asiatic",
      "Restaurant japonez",
      "Restaurant de sushi",
      "Restaurant libanez",
      "Restaurant de pește și fructe de mare",
      "Restaurant vegetarian",
      "Pizzerie",
      "Steakhouse",
      "Bistro",
      "Brasserie",
      "Cafenea",
      "Bar",
      "Wine bar",
      "Berărie",
    ],
  },
  beauty: {
    label: "Frumusețe și îngrijire",
    unit: { one: "post", many: "posturi", article: "un", kind: "chair" },
    usesPartySize: false,
    categories: [
      "Salon de înfrumusețare",
      "Coafor",
      "Frizerie",
      "Barbershop",
      "Salon de manichiură",
      "Salon de cosmetică",
      "Salon de gene și sprâncene",
      "Salon de masaj",
      "Spa",
      "Salon de bronzare",
      "Salon de epilare",
    ],
  },
  health: {
    label: "Sănătate",
    unit: { one: "specialist", many: "specialiști", article: "un", kind: "practitioner" },
    usesPartySize: false,
    categories: [
      "Cabinet stomatologic",
      "Clinică medicală",
      "Cabinet medical",
      "Cabinet de kinetoterapie",
      "Cabinet de fizioterapie",
      "Cabinet de psihologie",
      "Cabinet de nutriție",
      "Cabinet oftalmologic",
      "Clinică dermatologică",
      "Clinică de estetică",
      "Clinică veterinară",
      "Laborator de analize",
    ],
  },
  auto: {
    label: "Auto",
    unit: { one: "boxă", many: "boxe", article: "o", kind: "bay" },
    usesPartySize: false,
    categories: [
      "Detailing auto",
      "Service auto",
      "Spălătorie auto",
      "Vulcanizare",
      "Stație ITP",
      "Tuning și folie auto",
      "Service moto",
    ],
  },
  studio: {
    label: "Studiouri și ateliere",
    unit: { one: "post", many: "posturi", article: "un", kind: "chair" },
    usesPartySize: false,
    categories: [
      "Studio de tatuaj",
      "Studio de piercing",
      "Studio foto",
      "Studio de înregistrări",
      "Sală de repetiții",
      "Atelier de ceramică",
      "Atelier creativ",
    ],
  },
  sport: {
    label: "Sport și timp liber",
    unit: { one: "teren sau sală", many: "terenuri și săli", article: "un", kind: "room" },
    usesPartySize: false,
    categories: [
      "Teren de tenis",
      "Teren de padel",
      "Teren de fotbal",
      "Teren de baschet",
      "Sală de fitness",
      "Antrenor personal",
      "Studio de yoga",
      "Studio de pilates",
      "Sală de dans",
      "Bowling",
      "Biliard",
      "Escape room",
      "Karting",
    ],
  },
  services: {
    label: "Servicii profesionale",
    unit: { one: "specialist", many: "specialiști", article: "un", kind: "practitioner" },
    usesPartySize: false,
    categories: [
      "Consultanță",
      "Cabinet de avocatură",
      "Birou notarial",
      "Contabilitate",
      "Meditații",
      "Școală de șoferi",
      "Croitorie",
      "Service electronice",
    ],
  },
  other: {
    label: "Altceva",
    unit: { one: "loc", many: "locuri", article: "un", kind: "room" },
    usesPartySize: false,
    categories: [],
  },
} as const satisfies Record<string, Vertical>;

export type VerticalKey = keyof typeof VERTICALS;

export const CATEGORIES: readonly string[] = Object.values(VERTICALS).flatMap((v) => v.categories);

/** The select value that reveals a free-text category. */
export const CUSTOM_CATEGORY = "__custom__";
export const CUSTOM_CATEGORY_MAX = 60;

/**
 * Which vertical a category belongs to. A category typed by the owner is
 * "other". No category yet means a fresh registration, whose defaults are a
 * restaurant's (tables, party size).
 */
export function verticalOf(category: string | null | undefined): VerticalKey {
  if (!category) return "restaurant";
  for (const [key, v] of Object.entries(VERTICALS)) {
    if ((v.categories as readonly string[]).includes(category)) return key as VerticalKey;
  }
  return "other";
}

/** "Boxă 3", "Specialist 2". Tables keep the host-stand shorthand "M3". */
export function defaultResourceName(vertical: VerticalKey, n: number): string {
  if (vertical === "restaurant") return `M${n}`;
  const one = VERTICALS[vertical].unit.one.split(" ")[0];
  return `${one.charAt(0).toUpperCase()}${one.slice(1)} ${n}`;
}

/** Google shows a price range per person; these are the RON bands. */
export const PRICE_LEVELS = [
  { value: 1, label: "Sub 50 lei", symbol: "lei" },
  { value: 2, label: "50–100 lei", symbol: "lei lei" },
  { value: 3, label: "100–200 lei", symbol: "lei lei lei" },
  { value: 4, label: "Peste 200 lei", symbol: "lei lei lei lei" },
] as const;

export const DESCRIPTION_MAX = 750; // Google's limit

export const COUNTIES = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani",
  "Brăila", "Brașov", "București", "Buzău", "Călărași", "Caraș-Severin", "Cluj",
  "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu", "Gorj",
  "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov", "Maramureș", "Mehedinți",
  "Mureș", "Neamț", "Olt", "Prahova", "Sălaj", "Satu Mare", "Sibiu", "Suceava",
  "Teleorman", "Timiș", "Tulcea", "Vâlcea", "Vaslui", "Vrancea",
] as const;

// ---------------------------------------------------------------------------
// CUI / CIF
// ---------------------------------------------------------------------------

/** "RO 123 456 78" -> "12345678". The RO prefix only signals VAT registration. */
export function normaliseCui(input: string): string {
  return input.toUpperCase().replace(/^\s*RO/, "").replace(/\D/g, "");
}

/**
 * Romanian fiscal code check digit. The body is right-aligned against the key
 * 753217532; the check digit is (sum * 10) mod 11, with 10 mapping to 0.
 */
export function isValidCui(input: string): boolean {
  const cui = normaliseCui(input);
  if (cui.length < 2 || cui.length > 10) return false;

  const body = cui.slice(0, -1).padStart(9, "0");
  const check = Number(cui.at(-1));
  const key = "753217532";

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(body[i]) * Number(key[i]);

  const expected = ((sum * 10) % 11) % 10;
  return expected === check;
}

/**
 * Trade register number. Accepts the classic J40/1234/2020 and the EUID-style
 * J2020001234409 that ONRC has issued since 2024.
 */
export function isValidTradeRegisterNo(input: string): boolean {
  const v = input.trim().toUpperCase().replace(/\s+/g, "");
  return /^[JFC]\d{1,2}\/\d{1,7}\/\d{4}$/.test(v) || /^[JFC]\d{8,14}$/.test(v);
}

// ---------------------------------------------------------------------------
// Opening hours
// ---------------------------------------------------------------------------

export interface Interval {
  open: string; // "HH:MM"
  close: string; // "HH:MM"; at or before `open` means past midnight
}

/** Monday first, as Google lists them. Values are JS weekdays (0 = Sunday). */
export const WEEK = [
  { weekday: 1, label: "Luni" },
  { weekday: 2, label: "Marți" },
  { weekday: 3, label: "Miercuri" },
  { weekday: 4, label: "Joi" },
  { weekday: 5, label: "Vineri" },
  { weekday: 6, label: "Sâmbătă" },
  { weekday: 0, label: "Duminică" },
] as const;

export type WeekHours = Record<number, Interval[]>;

function toMinute(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function toHhmm(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Hours as entered -> ScheduleRule rows. A close at or before the open means
 * the venue runs past midnight, stored as endMinute > 1440 (CLAUDE.md §11).
 */
export function hoursToRules(
  hours: WeekHours,
): { ok: true; rules: { weekday: number; startMinute: number; endMinute: number }[] } | { ok: false; error: string } {
  const rules: { weekday: number; startMinute: number; endMinute: number }[] = [];

  for (const { weekday, label } of WEEK) {
    const day = (hours[weekday] ?? [])
      .map((iv) => {
        const start = toMinute(iv.open);
        const end = toMinute(iv.close);
        if (start === null || end === null) return null;
        return { start, end: end <= start ? end + 1440 : end };
      });

    if (day.some((d) => d === null)) {
      return { ok: false, error: `${label}: oră invalidă.` };
    }

    const sorted = (day as { start: number; end: number }[]).sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].start < sorted[i - 1].end) {
        return { ok: false, error: `${label}: intervalele se suprapun.` };
      }
    }

    for (const iv of sorted) {
      rules.push({ weekday, startMinute: iv.start, endMinute: iv.end });
    }
  }

  return { ok: true, rules };
}

export function rulesToHours(
  rules: { weekday: number; startMinute: number; endMinute: number }[],
): WeekHours {
  const out: WeekHours = {};
  for (const { weekday } of WEEK) out[weekday] = [];
  for (const r of [...rules].sort((a, b) => a.startMinute - b.startMinute)) {
    out[r.weekday]?.push({ open: toHhmm(r.startMinute), close: toHhmm(r.endMinute) });
  }
  return out;
}

/** "12:00–15:00, 18:00–23:00" or "Închis". */
export function describeDay(intervals: Interval[]): string {
  if (intervals.length === 0) return "Închis";
  return intervals.map((iv) => `${iv.open}–${iv.close}`).join(", ");
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/** "Hanul cu Tei — Centru" -> "hanul-cu-tei-centru". Strips diacritics. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "restaurant";
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export interface ReadinessInput {
  name: string;
  category: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  legalName: string | null;
  taxId: string | null;
  tradeRegisterNo: string | null;
  registeredAddress: string | null;
  activeTables: number;
  scheduleRules: number;
}

/**
 * What still stands between this business and a bookable public page. An
 * empty list means it can be published.
 */
export function missingForPublish(b: ReadinessInput): string[] {
  const missing: string[] = [];
  if (!b.category) missing.push("Categoria principală");
  if (!b.phone) missing.push("Telefonul");
  if (!b.address || !b.city) missing.push("Adresa");
  if (b.scheduleRules === 0) missing.push("Programul");
  if (b.activeTables === 0) {
    const u = VERTICALS[verticalOf(b.category)].unit;
    missing.push(`Cel puțin ${u.article} ${u.one}`);
  }
  if (!b.legalName || !b.taxId || !b.tradeRegisterNo || !b.registeredAddress) {
    missing.push("Datele firmei");
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Open now
// ---------------------------------------------------------------------------

/**
 * Whether the venue is open at `now` in its own timezone, and today's hours.
 * Yesterday's rules count too: open until 01:00 on Friday means open at 00:30
 * on Saturday.
 */
export function openStatus(
  rules: { weekday: number; startMinute: number; endMinute: number }[],
  local: { weekday: number; minute: number },
): { open: boolean; today: Interval[] } {
  const yesterday = (local.weekday + 6) % 7;

  const open = rules.some(
    (r) =>
      (r.weekday === local.weekday && r.startMinute <= local.minute && local.minute < r.endMinute) ||
      (r.weekday === yesterday && r.endMinute > 1440 && local.minute < r.endMinute - 1440),
  );

  return { open, today: rulesToHours(rules.filter((r) => r.weekday === local.weekday))[local.weekday] ?? [] };
}

/** Case- and diacritic-insensitive, for matching "brasov" to "Brașov". */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
