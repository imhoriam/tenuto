"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { REQUIREMENT, RESOURCE_KIND } from "@/lib/constants";
import { authorizeBusiness } from "@/lib/auth/session";
import {
  CATEGORIES,
  DESCRIPTION_MAX,
  hoursToRules,
  isValidCui,
  isValidTradeRegisterNo,
  missingForPublish,
  normaliseCui,
  type WeekHours,
} from "@/lib/business-profile";

export type SaveState = { ok?: boolean; message?: string; error?: string } | undefined;

type Business = NonNullable<Awaited<ReturnType<typeof authorizeBusiness>>>;

async function section(
  formData: FormData,
  fn: (business: Business, data: Record<string, string>) => Promise<SaveState>,
): Promise<SaveState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const business = await authorizeBusiness(data.slug ?? "");
  if (!business) return { error: "Sesiunea a expirat. Autentificați-vă din nou." };

  const result = await fn(business, data);
  if (result?.ok) {
    await unpublishIfIncomplete(business.id);
    revalidatePath(`/dashboard/${business.slug}`, "layout");
    revalidatePath("/restaurants");
    revalidatePath(`/book/${business.slug}`);
  }
  return result;
}

async function readiness(businessId: string) {
  const b = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    include: {
      locations: { take: 1 },
      _count: { select: { resources: { where: { active: true } }, scheduleRules: true } },
    },
  });
  return missingForPublish({
    ...b,
    address: b.locations[0]?.address ?? null,
    city: b.locations[0]?.city ?? null,
    activeTables: b._count.resources,
    scheduleRules: b._count.scheduleRules,
  });
}

/** Search must never list a restaurant that cannot take a booking. */
async function unpublishIfIncomplete(businessId: string) {
  if ((await readiness(businessId)).length > 0) {
    await db.business.updateMany({ where: { id: businessId, published: true }, data: { published: false } });
  }
}

const first = (issues: z.core.$ZodIssue[]) => issues[0]?.message ?? "Date invalide.";

/** Romanian counts: "1 masă", "3 mese", "20 de mese". */
function ro(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const mod = n % 100;
  return mod === 0 || mod >= 20 ? `${n} de ${many}` : `${n} ${many}`;
}

// ---------------------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().trim().min(2, "Numele este prea scurt.").max(80),
  category: z.enum(CATEGORIES, { message: "Alegeți o categorie." }),
  description: z.string().trim().max(DESCRIPTION_MAX, `Descrierea are maximum ${DESCRIPTION_MAX} de caractere.`),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s().-]{9,20}$/, "Număr de telefon invalid."),
  email: z.union([z.literal(""), z.string().trim().email("E-mail invalid.")]),
  website: z.string().trim().max(200),
  address: z.string().trim().min(3, "Completați strada și numărul."),
  city: z.string().trim().min(2, "Completați localitatea."),
  county: z.string().trim().min(2, "Alegeți județul."),
  postalCode: z.union([z.literal(""), z.string().trim().regex(/^\d{6}$/, "Codul poștal are 6 cifre.")]),
  priceLevel: z.union([z.literal(""), z.coerce.number().int().min(1).max(4)]),
});

export async function saveProfile(_prev: SaveState, formData: FormData): Promise<SaveState> {
  return section(formData, async (business, data) => {
    const parsed = profileSchema.safeParse(data);
    if (!parsed.success) return { error: first(parsed.error.issues) };
    const v = parsed.data;

    let website: string | null = v.website || null;
    if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
    if (website && !URL.canParse(website)) return { error: "Adresa site-ului nu este validă." };

    await db.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: business.id },
        data: {
          name: v.name,
          category: v.category,
          description: v.description || null,
          phone: v.phone,
          email: v.email || null,
          website,
          priceLevel: v.priceLevel === "" ? null : v.priceLevel,
        },
      });
      const location = await tx.location.findFirst({ where: { businessId: business.id } });
      const address = { address: v.address, city: v.city, county: v.county, postalCode: v.postalCode || null };
      if (location) await tx.location.update({ where: { id: location.id }, data: address });
      else await tx.location.create({ data: { businessId: business.id, name: "Principal", ...address } });
    });

    return { ok: true, message: "Profil salvat." };
  });
}

// ---------------------------------------------------------------------------

export async function saveHours(_prev: SaveState, formData: FormData): Promise<SaveState> {
  return section(formData, async (business, data) => {
    let hours: WeekHours;
    try {
      hours = JSON.parse(data.hours ?? "{}");
    } catch {
      return { error: "Program invalid." };
    }
    const res = hoursToRules(hours);
    if (!res.ok) return { error: res.error };

    await db.$transaction([
      db.scheduleRule.deleteMany({ where: { businessId: business.id, resourceId: null } }),
      db.scheduleRule.createMany({
        data: res.rules.map((r) => ({ ...r, businessId: business.id, resourceId: null })),
      }),
    ]);
    return { ok: true, message: res.rules.length === 0 ? "Program salvat — închis toată săptămâna." : "Program salvat." };
  });
}

// ---------------------------------------------------------------------------

const companySchema = z.object({
  legalName: z.string().trim().min(3, "Completați denumirea firmei."),
  taxId: z.string().refine(isValidCui, "CUI invalid — verificați cifra de control."),
  tradeRegisterNo: z.string().refine(isValidTradeRegisterNo, "Nr. Reg. Com. invalid (ex. J40/1234/2020)."),
  registeredAddress: z.string().trim().min(5, "Completați sediul social."),
  vatPayer: z.string().optional(),
});

export async function saveCompany(_prev: SaveState, formData: FormData): Promise<SaveState> {
  return section(formData, async (business, data) => {
    const parsed = companySchema.safeParse(data);
    if (!parsed.success) return { error: first(parsed.error.issues) };
    const v = parsed.data;

    await db.business.update({
      where: { id: business.id },
      data: {
        legalName: v.legalName,
        taxId: normaliseCui(v.taxId),
        tradeRegisterNo: v.tradeRegisterNo.trim().toUpperCase().replace(/\s+/g, ""),
        registeredAddress: v.registeredAddress,
        vatPayer: v.vatPayer === "on",
      },
    });
    return { ok: true, message: "Datele firmei au fost salvate." };
  });
}

// ---------------------------------------------------------------------------

const tablesSchema = z
  .array(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(1, "Fiecare masă are nevoie de un nume.").max(20),
      capacity: z.coerce.number().int().min(1, "Minimum 1 loc.").max(30, "Maximum 30 de locuri."),
    }),
  )
  .max(200);

export async function saveTables(_prev: SaveState, formData: FormData): Promise<SaveState> {
  return section(formData, async (business, data) => {
    let raw: unknown;
    try {
      raw = JSON.parse(data.tables ?? "[]");
    } catch {
      return { error: "Listă de mese invalidă." };
    }
    const parsed = tablesSchema.safeParse(raw);
    if (!parsed.success) return { error: first(parsed.error.issues) };

    const names = parsed.data.map((t) => t.name.toLowerCase());
    if (new Set(names).size !== names.length) return { error: "Două mese au același nume." };

    const location = await db.location.findFirst({ where: { businessId: business.id } });
    const existing = await db.resource.findMany({ where: { businessId: business.id } });
    const keep = new Set(parsed.data.map((t) => t.id).filter(Boolean));

    await db.$transaction(async (tx) => {
      for (const t of parsed.data) {
        const own = t.id && existing.some((e) => e.id === t.id);
        if (own) {
          await tx.resource.update({ where: { id: t.id }, data: { name: t.name, capacity: t.capacity, active: true } });
        } else {
          await tx.resource.create({
            data: {
              businessId: business.id,
              locationId: location?.id ?? null,
              name: t.name,
              capacity: t.capacity,
              kind: RESOURCE_KIND.TABLE,
            },
          });
        }
      }
      // Removed tables are deactivated, not deleted: past bookings still
      // point at them, and the audit trail must keep resolving.
      const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
      if (removed.length > 0) {
        await tx.resource.updateMany({ where: { id: { in: removed } }, data: { active: false } });
      }
    });

    const seats = parsed.data.reduce((s, t) => s + t.capacity, 0);
    return { ok: true, message: `${ro(parsed.data.length, "masă", "mese")}, ${ro(seats, "loc", "locuri")}.` };
  });
}

// ---------------------------------------------------------------------------

const rulesSchema = z.object({
  gracePeriodMin: z.coerce.number().int().min(5, "Toleranța: minimum 5 minute.").max(60, "Toleranța: maximum 60 de minute."),
  noShowFeeLei: z.coerce.number().int().min(10, "Taxa: minimum 10 lei.").max(2000, "Taxa: maximum 2000 de lei."),
  cancellationWindowHours: z.coerce.number().int().min(0).max(168, "Anularea gratuită: maximum 7 zile."),
  durationMin: z.coerce.number().int().min(30).max(360),
  regularsEnabled: z.string().optional(),
  regularsAfter: z.coerce.number().int().min(1).max(50),
});

export async function saveRules(_prev: SaveState, formData: FormData): Promise<SaveState> {
  return section(formData, async (business, data) => {
    const parsed = rulesSchema.safeParse(data);
    if (!parsed.success) return { error: first(parsed.error.issues) };
    const v = parsed.data;

    await db.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: business.id },
        data: {
          gracePeriodMin: v.gracePeriodMin,
          // Integer lei in, integer bani stored — invariant 6.
          noShowFeeCents: v.noShowFeeLei * 100,
          cancellationWindowHours: v.cancellationWindowHours,
        },
      });

      await tx.service.updateMany({
        where: { businessId: business.id, active: true },
        data: { durationMin: v.durationMin },
      });

      const regulars = await tx.policyRule.findFirst({
        where: { businessId: business.id, requirement: REQUIREMENT.NONE, minCompletedHere: { not: null } },
      });
      if (regulars) {
        await tx.policyRule.update({
          where: { id: regulars.id },
          data: { enabled: v.regularsEnabled === "on", minCompletedHere: v.regularsAfter },
        });
      } else if (v.regularsEnabled === "on") {
        await tx.policyRule.create({
          data: {
            businessId: business.id,
            name: "Clienții fideli rezervă fără card",
            priority: 10,
            minCompletedHere: v.regularsAfter,
            requirement: REQUIREMENT.NONE,
          },
        });
      }
    });

    return {
      ok: true,
      message: "Reguli salvate. Rezervările existente păstrează condițiile acceptate de client.",
    };
  });
}

// ---------------------------------------------------------------------------

export async function setPublished(_prev: SaveState, formData: FormData): Promise<SaveState> {
  return section(formData, async (business, data) => {
    const publish = data.publish === "1";
    if (publish) {
      const missing = await readiness(business.id);
      if (missing.length > 0) return { error: `Mai lipsesc: ${missing.join(", ")}.` };
    }
    await db.business.update({ where: { id: business.id }, data: { published: publish } });
    return {
      ok: true,
      message: publish ? "Publicat — restaurantul apare acum în căutare." : "Retras din căutare. Linkul direct funcționează în continuare.",
    };
  });
}
