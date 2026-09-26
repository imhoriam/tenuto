import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import {
  BOOKING_STATUS,
  CHARGE_STATUS,
  REQUIREMENT,
  type BookingStatus,
} from "@/lib/constants";
import { canMarkNoShow } from "@/lib/booking/state-machine";
import { dayIn, money, timeIn } from "@/lib/format";
import { ServiceBoard } from "./service-board";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const business = await db.business.findUnique({ where: { slug } });
  if (!business) notFound();

  const now = new Date();
  const windowStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const bookings = await db.booking.findMany({
    where: {
      businessId: business.id,
      startAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      customer: true,
      resource: true,
      mandate: true,
      charges: true,
    },
    orderBy: { startAt: "asc" },
  });

  // Money recovered, all time — the number that justifies the invoice.
  const recovered = await db.charge.aggregate({
    where: {
      status: CHARGE_STATUS.SUCCEEDED,
      booking: { businessId: business.id },
    },
    _sum: { amountCents: true },
    _count: true,
  });

  const protectedCount = bookings.filter(
    (b) => b.requirement !== REQUIREMENT.NONE,
  ).length;

  const rows = bookings.map((b) => {
    const check = canMarkNoShow(
      {
        status: b.status as BookingStatus,
        startAt: b.startAt,
        gracePeriodMin: business.gracePeriodMin,
        checkedInAt: b.checkedInAt,
      },
      now,
    );

    return {
      id: b.id,
      reference: b.reference,
      time: timeIn(b.startAt, business.timezone),
      day: dayIn(b.startAt, business.timezone),
      startAtIso: b.startAt.toISOString(),
      partySize: b.partySize,
      table: b.resource.name,
      customerName: b.customer.name,
      customerPhone: b.customer.phone,
      note: b.customerNote,
      status: b.status as BookingStatus,
      requirement: b.requirement,
      feeLabel: b.feeCents > 0 ? money(b.feeCents, business.currency) : null,
      cardLast4: b.mandate?.cardLast4 ?? null,
      canMarkAbsent: check.ok,
      blockedReason: check.ok ? null : check.reason,
      chargeStatus: b.charges.at(-1)?.status ?? null,
      chargeError: b.charges.at(-1)?.lastError ?? null,
      isActive: !([
        BOOKING_STATUS.CANCELLED_FREE,
        BOOKING_STATUS.EXPIRED,
      ] as string[]).includes(b.status),
    };
  });

  const todayLabel = dayIn(now, business.timezone);

  return (
    <main className="min-h-dvh bg-stone-100 text-stone-900">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
              Tenuto
            </p>
            <h1 className="mt-1 font-serif text-3xl text-stone-900">
              {business.name}
            </h1>
            <p className="mt-1 text-sm capitalize text-stone-500">{todayLabel}</p>
            <Link
              href={`/dashboard/${business.slug}/qr`}
              className="mt-2 inline-block text-sm text-stone-500 underline underline-offset-4 transition hover:text-stone-900"
            >
              Cod QR pentru intrare →
            </Link>
          </div>

          <div className="flex gap-3">
            <Stat
              label="Recuperat"
              value={money(recovered._sum.amountCents ?? 0, business.currency)}
              sub={`${recovered._count} ${recovered._count === 1 ? "absență" : "absențe"}`}
              accent
            />
            <Stat
              label="Protejate"
              value={`${protectedCount}/${bookings.length}`}
              sub="cu card"
            />
            <Stat
              label="Toleranță"
              value={`${business.gracePeriodMin} min`}
              sub="masa e ținută"
            />
          </div>
        </header>

        <ServiceBoard slug={business.slug} rows={rows} />
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        accent
          ? "border-emerald-200 bg-emerald-50"
          : "border-stone-200 bg-white"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
      <p className="text-xs text-stone-400">{sub}</p>
    </div>
  );
}
