import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Logo } from "@/components/logo";
import { btn, field, label } from "@/components/ui";
import { db } from "@/lib/db";
import { CHARGE_STATUS, DISPUTE_STATUS } from "@/lib/constants";
import { isAdminAuthorization } from "@/lib/auth/admin";
import { dayIn, money, timeIn } from "@/lib/format";
import { resolveDisputeAction, setSuspendedAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** A dispute rate worth a human look: at least this many disputes, and this share of charges. */
const FLAG_MIN_DISPUTES = 3;
const FLAG_RATE = 0.2;

export default async function AdminPage() {
  if (!isAdminAuthorization((await headers()).get("authorization"))) notFound();

  const [open, businesses] = await Promise.all([
    db.dispute.findMany({
      where: { status: DISPUTE_STATUS.OPEN },
      orderBy: { openedAt: "asc" },
      include: {
        booking: {
          include: {
            business: true,
            customer: true,
            charges: true,
            policySnapshot: true,
            checkIns: true,
            events: { orderBy: { at: "asc" } },
          },
        },
      },
    }),
    db.business.findMany({
      orderBy: { name: "asc" },
      include: {
        bookings: { select: { status: true, charges: { select: { status: true } }, dispute: { select: { status: true, resolvedBy: true } } } },
      },
    }),
  ]);

  const stats = businesses
    .map((b) => {
      const charged = b.bookings.filter((bk) =>
        bk.charges.some((c) => c.status === CHARGE_STATUS.SUCCEEDED || c.status === CHARGE_STATUS.REFUNDED),
      ).length;
      const disputes = b.bookings.filter((bk) => bk.dispute).map((bk) => bk.dispute!);
      const rate = charged === 0 ? 0 : disputes.length / charged;
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        suspended: Boolean(b.suspendedAt),
        charged,
        disputes: disputes.length,
        open: disputes.filter((d) => d.status === DISPUTE_STATUS.OPEN).length,
        refundedByBusiness: disputes.filter((d) => d.status === DISPUTE_STATUS.REFUNDED && d.resolvedBy === "business").length,
        refundedByPlatform: disputes.filter((d) => d.status === DISPUTE_STATUS.REFUNDED && d.resolvedBy === "platform").length,
        upheld: disputes.filter((d) => d.status === DISPUTE_STATUS.UPHELD).length,
        rate,
        flagged: disputes.length >= FLAG_MIN_DISPUTES && rate >= FLAG_RATE,
      };
    })
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.rate - a.rate);

  return (
    <main className="min-h-dvh">
      <header className="border-b-2 border-blue bg-blue text-paper">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo onDark />
          <span className={`${label} text-pink-soft`}>Admin · contestații</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-5xl font-bold tracking-[-0.05em] text-blue">
          {open.length === 0 ? "Nicio contestație deschisă." : `${open.length} ${open.length === 1 ? "contestație deschisă" : "contestații deschise"}`}
        </h1>
        <p className="mt-2 max-w-2xl text-ink">
          Banii fiecărei contestații sunt blocați până decizi. Rambursarea îi trimite înapoi clientului; „taxa rămâne” îi
          eliberează restaurantului. Decizia și nota ta apar clientului pe pagina rezervării.
        </p>

        <div className="mt-8 space-y-6">
          {open.map((d) => {
            const bk = d.booking;
            const tz = bk.business.timezone;
            const charge = bk.charges.find((c) => c.status === CHARGE_STATUS.SUCCEEDED);
            return (
              <article key={d.id} className="rounded-lg border-2 border-blue bg-sheet">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-blue p-5">
                  <div>
                    <p className={`${label} text-pink-deep`}>
                      {bk.reference} · deschisă pe {dayIn(d.openedAt, tz)}
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-blue">
                      {bk.customer.name} vs. {bk.business.name}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Rezervare {dayIn(bk.startAt, tz)}, {timeIn(bk.startAt, tz)} · {bk.partySize} pers. · {bk.customer.phone}
                    </p>
                  </div>
                  <p className="text-3xl font-bold tracking-tight text-blue">
                    {charge ? money(charge.amountCents, charge.currency) : "—"}
                  </p>
                </div>

                <div className="grid gap-6 p-5 lg:grid-cols-2">
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className={`${label} text-muted`}>Motivul clientului</p>
                      <p className="mt-1 text-[15px] text-ink">{d.reason ? `„${d.reason}”` : "Fără motiv scris."}</p>
                    </div>
                    <div>
                      <p className={`${label} text-muted`}>Ce a acceptat</p>
                      <p className="mt-1 text-ink">„{bk.policySnapshot?.policyText ?? "—"}”</p>
                      <p className="mt-1 text-xs text-muted">
                        Toleranță {bk.policySnapshot?.gracePeriodMin ?? bk.business.gracePeriodMin} min · acceptat{" "}
                        {bk.policySnapshot ? `${dayIn(bk.policySnapshot.acceptedAt, tz)}, IP ${bk.policySnapshot.ipAddress ?? "—"}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className={`${label} text-muted`}>Sosire înregistrată</p>
                      <p className="mt-1 text-ink">
                        {bk.checkIns.length === 0
                          ? "Niciuna."
                          : bk.checkIns.map((c) => `${timeIn(c.at, tz)} (${c.actorLabel ?? c.method})`).join(", ")}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className={`${label} text-muted`}>Istoric</p>
                    <ol className="mt-2 space-y-1.5 border-l-2 border-blue/30 pl-4 font-mono text-xs">
                      {bk.events.map((e) => (
                        <li key={e.id} className="text-ink">
                          <span className="text-muted">
                            {dayIn(e.at, tz).split(",")[0]} {timeIn(e.at, tz)}
                          </span>{" "}
                          {e.fromStatus ?? "—"} → <b>{e.toStatus}</b>{" "}
                          <span className="text-muted">
                            {e.actorType}
                            {e.actorLabel ? `/${e.actorLabel}` : ""}
                            {e.reason ? ` · ${e.reason}` : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <form action={resolveDisputeAction} className="flex flex-wrap items-end gap-3 border-t-2 border-dashed border-blue/30 p-5">
                  <input type="hidden" name="bookingId" value={bk.id} />
                  <label className="min-w-0 flex-1">
                    <span className={field.label}>Notă pentru client (opțional)</span>
                    <input name="note" maxLength={500} className={field.input} placeholder="Ex.: sosirea nu apare în istoric; toleranța a fost respectată." />
                  </label>
                  <button type="submit" name="outcome" value="refund" className={btn.primary}>
                    Rambursează clientul
                  </button>
                  <button type="submit" name="outcome" value="uphold" className={btn.ghost}>
                    Taxa rămâne
                  </button>
                </form>
              </article>
            );
          })}
        </div>

        <h2 className="mt-16 text-3xl font-bold tracking-[-0.04em] text-blue">Restaurante</h2>
        <p className="mt-1 text-sm text-muted">
          Marcate când au cel puțin {FLAG_MIN_DISPUTES} contestații și o rată de peste {Math.round(FLAG_RATE * 100)}% din taxele
          încasate.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border-2 border-blue bg-sheet">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className={`${label} border-b-2 border-blue text-blue`}>
              <tr>
                <th className="p-3">Restaurant</th>
                <th className="p-3">Taxe</th>
                <th className="p-3">Contestații</th>
                <th className="p-3">Rambursate (rest. / Tenuto)</th>
                <th className="p-3">Menținute</th>
                <th className="p-3">Rată</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-dashed divide-blue/15">
              {stats.map((s) => (
                <tr key={s.id} className={s.flagged ? "bg-pink-soft" : ""}>
                  <td className="p-3 font-semibold text-ink">
                    {s.name}
                    {s.flagged ? <span className="ml-2 font-mono text-[11px] font-bold uppercase text-pink-deep">de verificat</span> : null}
                    {s.suspended ? <span className="ml-2 font-mono text-[11px] font-bold uppercase text-red-800">suspendat</span> : null}
                  </td>
                  <td className="p-3 tabular-nums">{s.charged}</td>
                  <td className="p-3 tabular-nums">
                    {s.disputes}
                    {s.open ? ` (${s.open} deschise)` : ""}
                  </td>
                  <td className="p-3 tabular-nums">
                    {s.refundedByBusiness} / {s.refundedByPlatform}
                  </td>
                  <td className="p-3 tabular-nums">{s.upheld}</td>
                  <td className="p-3 font-mono tabular-nums">{Math.round(s.rate * 100)}%</td>
                  <td className="p-3 text-right">
                    <form action={setSuspendedAction}>
                      <input type="hidden" name="businessId" value={s.id} />
                      <input type="hidden" name="suspend" value={s.suspended ? "0" : "1"} />
                      <button type="submit" className={btn.small}>
                        {s.suspended ? "Reactivează" : "Suspendă"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
