import { db } from "@/lib/db";
import { REQUIREMENT } from "@/lib/constants";
import { requireBusiness } from "@/lib/auth/session";
import { missingForPublish, rulesToHours } from "@/lib/business-profile";
import { money } from "@/lib/format";
import { SettingsForms } from "./settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params, searchParams }: PageProps<"/dashboard/[slug]/settings">) {
  const { slug } = await params;
  const { welcome } = await searchParams;
  const owned = await requireBusiness(slug);

  const b = await db.business.findUniqueOrThrow({
    where: { id: owned.id },
    include: {
      locations: { take: 1 },
      resources: { where: { active: true }, orderBy: [{ name: "asc" }] },
      scheduleRules: { where: { resourceId: null } },
      services: { where: { active: true }, take: 1 },
      policyRules: { orderBy: { priority: "asc" } },
    },
  });

  const loc = b.locations[0];
  const regulars = b.policyRules.find((r) => r.requirement === REQUIREMENT.NONE && r.minCompletedHere !== null);

  const missing = missingForPublish({
    ...b,
    address: loc?.address ?? null,
    city: loc?.city ?? null,
    activeTables: b.resources.length,
    scheduleRules: b.scheduleRules.length,
  });

  const REQ_LABEL: Record<string, string> = {
    [REQUIREMENT.NONE]: "fără card",
    [REQUIREMENT.CARD_ON_FILE]: "card ca garanție",
    [REQUIREMENT.DEPOSIT]: "avans",
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {welcome ? (
        <div className="relative mb-8 overflow-hidden rounded-lg border-2 border-blue bg-blue p-6 text-paper sm:p-8">
          <div aria-hidden="true" className="halftone-pink pointer-events-none absolute -right-10 -top-10 h-48 w-80 opacity-50 [mask-image:radial-gradient(circle_at_80%_20%,#000,transparent_70%)]" />
          <p className="relative font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-pink-soft">Cont creat</p>
          <p className="relative mt-2 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">Bine ai venit, {b.name}.</p>
          <p className="relative mt-2 max-w-xl text-paper/85">
            Completează secțiunile de mai jos — exact ca pe profilul tău Google. Când totul e gata, publici afacerea
            și apare în căutare.
          </p>
        </div>
      ) : null}

      <SettingsForms
        slug={b.slug}
        published={b.published}
        missing={missing}
        profile={{
          name: b.name,
          category: b.category ?? "",
          description: b.description ?? "",
          phone: b.phone ?? "",
          email: b.email ?? "",
          website: b.website ?? "",
          address: loc?.address ?? "",
          city: loc?.city ?? "",
          county: loc?.county ?? "",
          postalCode: loc?.postalCode ?? "",
          priceLevel: b.priceLevel ? String(b.priceLevel) : "",
        }}
        hours={rulesToHours(b.scheduleRules)}
        company={{
          legalName: b.legalName ?? "",
          taxId: b.taxId ?? "",
          tradeRegisterNo: b.tradeRegisterNo ?? "",
          registeredAddress: b.registeredAddress ?? "",
          vatPayer: b.vatPayer,
        }}
        tables={b.resources.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity }))}
        rules={{
          gracePeriodMin: b.gracePeriodMin,
          noShowFeeLei: Math.round(b.noShowFeeCents / 100),
          cancellationWindowHours: b.cancellationWindowHours,
          durationMin: b.services[0]?.durationMin ?? 120,
          regularsEnabled: regulars?.enabled ?? false,
          regularsAfter: regulars?.minCompletedHere ?? 3,
        }}
        policy={b.policyRules.map((r) => ({
          id: r.id,
          name: r.name,
          priority: r.priority,
          enabled: r.enabled,
          outcome:
            r.requirement === REQUIREMENT.NONE
              ? REQ_LABEL[r.requirement]
              : `${REQ_LABEL[r.requirement] ?? r.requirement} · ${money(r.feeCentsOverride ?? b.noShowFeeCents, b.currency)}`,
        }))}
      />
    </main>
  );
}
