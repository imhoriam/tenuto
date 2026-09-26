import Link from "next/link";

import { btn } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS,
  CHARGE_STATUS,
  DISPUTE_WINDOW_DAYS,
  PAYOUT_STATUS,
  type BookingStatus,
} from "@/lib/constants";
import { requireBusiness } from "@/lib/auth/session";
import { missingForPublish } from "@/lib/business-profile";
import { releaseDuePayouts, sweepNoShows } from "@/lib/booking/service";
import { dayIn, money, timeIn } from "@/lib/format";
import { requestOrigin } from "@/lib/origin";
import { LiveRefresh } from "./live-refresh";
import { ServiceBoard, type Row } from "./service-board";

export const dynamic = "force-dynamic";

const COLLECTABLE: BookingStatus[] = [
  BOOKING_STATUS.NO_SHOW_PENDING,
  BOOKING_STATUS.CANCELLED_LATE,
  BOOKING_STATUS.CHARGE_FAILED,
];

function untilLabel(target: Date, now: Date): string {
  const min = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export default async function DashboardPage({ params }: PageProps<"/dashboard/[slug]">) {
  const { slug } = await params;
  const business = await requireBusiness(slug);

  // No worker yet: a grace period that ran out while nobody was looking is
  // recorded the moment someone looks.
  await sweepNoShows({ businessId: business.id });
  await releaseDuePayouts({ businessId: business.id });

  const now = new Date();
  const windowStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const [bookings, paidOut, onHold, collectable, readiness] = await Promise.all([
    db.booking.findMany({
      where: {
        businessId: business.id,
        OR: [
          { startAt: { gte: windowStart, lte: windowEnd } },
          // A dispute usually lands days later; it stays on the board until settled.
          { status: BOOKING_STATUS.DISPUTED },
        ],
      },
      include: {
        customer: true,
        resource: true,
        service: { select: { usesPartySize: true } },
        mandate: true,
        charges: { orderBy: { attempt: "asc" } },
        policySnapshot: true,
        dispute: true,
      },
      orderBy: { startAt: "asc" },
    }),
    db.charge.aggregate({
      where: { status: CHARGE_STATUS.SUCCEEDED, payoutStatus: PAYOUT_STATUS.RELEASED, booking: { businessId: business.id } },
      _sum: { amountCents: true },
      _count: true,
    }),
    db.charge.aggregate({
      where: {
        status: CHARGE_STATUS.SUCCEEDED,
        payoutStatus: { in: [PAYOUT_STATUS.HELD, PAYOUT_STATUS.FROZEN] },
        booking: { businessId: business.id },
      },
      _sum: { amountCents: true },
      _count: true,
    }),
    // Everything that is, or will become, collectable — not just tonight's.
    db.booking.findMany({
      where: {
        businessId: business.id,
        status: { in: COLLECTABLE },
        chargeableAt: { not: null },
        feeCents: { gt: 0 },
        mandate: { isNot: null },
      },
      select: { chargeableAt: true, feeCents: true },
    }),
    db.business.findUniqueOrThrow({
      where: { id: business.id },
      include: {
        locations: { take: 1 },
        _count: { select: { resources: { where: { active: true } }, scheduleRules: true } },
      },
    }),
  ]);

  const due = collectable.filter((b) => b.chargeableAt! <= now);
  const disputes = bookings.filter((b) => b.status === BOOKING_STATUS.DISPUTED);

  const missing = missingForPublish({
    ...readiness,
    address: readiness.locations[0]?.address ?? null,
    city: readiness.locations[0]?.city ?? null,
    activeTables: readiness._count.resources,
    scheduleRules: readiness._count.scheduleRules,
  });

  const rows: Row[] = bookings.map((b) => {
    const grace = b.policySnapshot?.gracePeriodMin ?? business.gracePeriodMin;
    const graceEnd = new Date(b.startAt.getTime() + grace * 60_000);
    const status = b.status as BookingStatus;
    const lastCharge = b.charges.at(-1);

    let hint: string | null = null;
    if (status === BOOKING_STATUS.CONFIRMED && now < graceEnd && now >= b.startAt) {
      hint = `Toleranță: încă ${untilLabel(graceEnd, now)}`;
    } else if (status === BOOKING_STATUS.NO_SHOW_PENDING) {
      hint = "Locul s-a eliberat · taxa se poate încasa. A venit totuși? Marchează-l sosit.";
    } else if (status === BOOKING_STATUS.DISPUTED) {
      hint = `Clientul contestă${b.dispute?.reason ? `: „${b.dispute.reason}”` : ""} · banii sunt blocați până la rezolvare`;
    } else if (status === BOOKING_STATUS.CHARGE_SUCCEEDED) {
      const held = lastCharge?.payoutStatus === PAYOUT_STATUS.HELD && lastCharge.payoutReleaseAt;
      hint = held ? `În așteptare — ajunge la tine pe ${dayIn(lastCharge.payoutReleaseAt!, business.timezone)}` : null;
    } else if (status === BOOKING_STATUS.CHARGE_FAILED && b.chargeableAt) {
      hint = `Reîncercare ${b.chargeableAt > now ? `în ${untilLabel(b.chargeableAt, now)}` : "scadentă"}`;
    }

    return {
      id: b.id,
      reference: b.reference,
      time: timeIn(b.startAt, business.timezone),
      day: dayIn(b.startAt, business.timezone),
      isToday: dayIn(b.startAt, business.timezone) === dayIn(now, business.timezone),
      partySize: b.service.usesPartySize ? b.partySize : null,
      table: b.resource.name,
      customerName: b.customer.name,
      customerPhone: b.customer.phone,
      note: b.customerNote,
      status,
      requirement: b.requirement,
      feeLabel: b.feeCents > 0 ? money(b.feeCents, business.currency) : null,
      cardLast4: b.mandate?.cardLast4 ?? null,
      hint,
      arrivedAt: b.checkedInAt ? timeIn(b.checkedInAt, business.timezone) : null,
      chargeError: lastCharge?.lastError ?? null,
    };
  });

  const dueTotal = due.reduce((s, b) => s + b.feeCents, 0);
  const arrived = bookings.filter((b) => b.status === BOOKING_STATUS.CHECKED_IN).length;
  const expectedToday = rows.filter((r) => r.isToday && r.status !== BOOKING_STATUS.CANCELLED_FREE).length;
  const bookingUrl = `${await requestOrigin()}/book/${business.slug}`;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <LiveRefresh />

      {business.suspendedAt ? (
        <div className="mb-8 rounded-lg border-2 border-red-700 bg-red-50 p-5">
          <p className="font-bold text-red-900">Contul este suspendat de Tenuto.</p>
          <p className="mt-1 text-sm text-red-900">
            Nu primești rezervări noi și nu poți încasa taxe până la reactivare. Scrie-ne la contact@tenuto.ro.
          </p>
        </div>
      ) : null}

      {disputes.length > 0 ? (
        <div className="mb-8 rounded-lg border-2 border-blue bg-blue-soft p-5">
          <p className="font-bold text-blue">
            {disputes.length === 1 ? "O contestație deschisă" : `${disputes.length} contestații deschise`}
          </p>
          <p className="mt-1 text-sm text-ink">
            Banii rămân blocați până la rezolvare. Poți rambursa oricând; dacă nu, Tenuto verifică istoricul rezervării și
            decide.
          </p>
        </div>
      ) : null}

      {!business.published && !business.suspendedAt ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-blue bg-pink-soft p-5">
          <div>
            <p className="font-bold text-blue">Restaurantul nu apare încă în căutare.</p>
            <p className="mt-1 text-sm text-ink">
              {missing.length > 0 ? `Mai lipsesc: ${missing.join(", ")}.` : "Profilul e complet — îl poți publica din Setări."}
            </p>
          </div>
          <Link href={`/dashboard/${business.slug}/settings`} className={btn.primary}>
            Completează profilul
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-pink-deep">{dayIn(now, business.timezone)}</p>
          <h1 className="mt-1 text-5xl font-bold leading-none tracking-[-0.055em] text-blue sm:text-6xl">
            Seara de{" "}
            <span className="overprint" data-text="azi">
              azi
            </span>
          </h1>
        </div>
        <div className="flex max-w-full items-center gap-2 rounded-md border-2 border-blue bg-sheet py-1 pl-3 pr-1 text-sm">
          <span className="max-w-[14rem] truncate font-mono text-xs text-muted sm:max-w-xs">{bookingUrl}</span>
          <CopyButton text={bookingUrl} label="Copiază linkul" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border-2 border-blue bg-blue lg:grid-cols-4">
        <Stat label="Sosiți" value={`${arrived}/${expectedToday}`} sub="rezervări azi" />
        <Stat
          label="Recuperat"
          value={money(paidOut._sum.amountCents ?? 0, business.currency)}
          sub={`plătit, din ${paidOut._count} ${paidOut._count === 1 ? "neprezentare" : "neprezentări"}`}
          tone="pink"
        />
        <Stat
          label="În așteptare"
          value={money(onHold._sum.amountCents ?? 0, business.currency)}
          sub={`${DISPUTE_WINDOW_DAYS} zile pentru contestații`}
        />
        <Stat label="Toleranță" value={`${business.gracePeriodMin} min`} sub="apoi locul se eliberează" />
      </div>

      <ServiceBoard
        slug={business.slug}
        rows={rows}
        dueCount={due.length}
        dueLabel={money(dueTotal, business.currency)}
        suspended={Boolean(business.suspendedAt)}
      />
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "pink" }) {
  return (
    <div className={`p-5 ${tone === "pink" ? "bg-pink" : "bg-sheet"}`}>
      <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.16em] ${tone === "pink" ? "text-ink" : "text-muted"}`}>{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums tracking-[-0.04em] ${tone === "pink" ? "text-ink" : "text-blue"}`}>{value}</p>
      <p className={`mt-0.5 text-xs ${tone === "pink" ? "text-ink/80" : "text-muted"}`}>{sub}</p>
    </div>
  );
}
