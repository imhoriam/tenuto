import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/logo";
import { btn, label } from "@/components/ui";
import { db } from "@/lib/db";
import { BOOKING_STATUS } from "@/lib/constants";
import { getCurrentAccount } from "@/lib/auth/session";
import { dayIn, isoDateIn, timeIn } from "@/lib/format";
import { ConfirmArrival } from "./confirm-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmare sosire", robots: { index: false, follow: false } };

/**
 * What the host's phone opens after scanning a customer's QR code.
 *
 * Confirming needs the restaurant's own session, and a separate tap — never a
 * side effect of simply opening the URL, which link previews and prefetching
 * would otherwise trigger. A customer scanning their own code gets pointed
 * back to their booking page instead.
 */
export default async function ScanPage({ params }: PageProps<"/sosire/[token]">) {
  const { token } = await params;
  if (token.length < 16) notFound();

  const booking = await db.booking.findUnique({
    where: { accessToken: token },
    include: { business: true, customer: true, resource: true, policySnapshot: true },
  });
  if (!booking) notFound();

  const account = await getCurrentAccount();

  if (!account) {
    return (
      <Shell>
        <p className={`${label} text-pink-deep`}>Cod de sosire · {booking.reference}</p>
        <h1 className="mt-3 text-4xl font-bold leading-[0.95] tracking-[-0.05em] text-blue">
          Acest cod îl scanează personalul restaurantului.
        </h1>
        <p className="mt-4 text-ink">
          Arată-l la intrare. Dacă lucrezi la {booking.business.name}, autentifică-te și scanează din nou.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/login?next=${encodeURIComponent(`/sosire/${token}`)}`} className={btn.primary}>
            Sunt de la restaurant
          </Link>
          <Link href={`/r/${token}`} className={btn.ghost}>
            Vezi rezervarea
          </Link>
        </div>
      </Shell>
    );
  }

  if (account.businessId !== booking.businessId) {
    return (
      <Shell>
        <h1 className="text-4xl font-bold tracking-[-0.05em] text-blue">Rezervare la alt restaurant.</h1>
        <p className="mt-3 text-ink">
          Codul e pentru {booking.business.name}. Ești autentificat ca {account.business.name}.
        </p>
        <Link href={`/dashboard/${account.business.slug}`} className={`${btn.ghost} mt-6`}>
          Înapoi la panou
        </Link>
      </Shell>
    );
  }

  const tz = booking.business.timezone;
  const status = booking.status;
  const now = new Date();
  const isToday = isoDateIn(booking.startAt, tz) === isoDateIn(now, tz);
  const grace = booking.policySnapshot?.gracePeriodMin ?? booking.business.gracePeriodMin;
  const graceEnd = new Date(booking.startAt.getTime() + grace * 60_000);

  const canConfirm = status === BOOKING_STATUS.CONFIRMED || status === BOOKING_STATUS.NO_SHOW_PENDING;
  const warning = !isToday
    ? `Atenție: rezervarea e pentru ${dayIn(booking.startAt, tz)}, nu pentru azi.`
    : status === BOOKING_STATUS.NO_SHOW_PENDING
      ? `A ajuns după toleranța de ${grace} min (până la ${timeIn(graceEnd, tz)}). Confirmând, nu se mai percepe taxa.`
      : null;

  return (
    <Shell back={`/dashboard/${account.business.slug}`}>
      <p className={`${label} text-pink-deep`}>
        {booking.reference} · {isToday ? "azi" : dayIn(booking.startAt, tz)}
      </p>
      <h1 className="mt-2 text-5xl font-bold leading-[0.95] tracking-[-0.05em] text-blue">{booking.customer.name}</h1>

      <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-lg border-2 border-blue bg-sheet text-center">
        <Fact k="Ora" v={timeIn(booking.startAt, tz)} />
        <Fact k="Pers." v={String(booking.partySize)} mid />
        <Fact k="Masa" v={booking.resource.name} />
      </div>
      {booking.customerNote ? <p className="mt-4 text-sm italic text-ink">„{booking.customerNote}”</p> : null}

      <div className="mt-8">
        {status === BOOKING_STATUS.CHECKED_IN || status === BOOKING_STATUS.COMPLETED ? (
          <div className="rounded-lg border-[3px] border-emerald-700 bg-emerald-50 p-6 text-center">
            <p className="text-3xl font-bold tracking-tight text-emerald-900">Deja sosit ✓</p>
            <p className="mt-1 text-emerald-900">
              Înregistrat la {booking.checkedInAt ? timeIn(booking.checkedInAt, tz) : "—"}.
            </p>
          </div>
        ) : canConfirm ? (
          <ConfirmArrival token={token} customerName={booking.customer.name} warning={warning} />
        ) : (
          <div className="rounded-lg border-2 border-blue bg-blue-soft p-5 text-ink">
            Rezervarea nu mai e activă ({status}). Sosirea nu mai poate fi confirmată de aici.
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children, back }: { children: React.ReactNode; back?: string }) {
  return (
    <main className="min-h-dvh">
      <header className="border-b-2 border-blue">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <Logo className="scale-90" />
          {back ? (
            <Link href={back} className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-blue">
              Panou →
            </Link>
          ) : null}
        </div>
      </header>
      <div className="mx-auto w-full max-w-md px-4 py-10">{children}</div>
    </main>
  );
}

function Fact({ k, v, mid }: { k: string; v: string; mid?: boolean }) {
  return (
    <div className={`py-4 ${mid ? "border-x-2 border-blue" : ""}`}>
      <p className={`${label} text-muted`}>{k}</p>
      <p className="mt-1 text-2xl font-bold text-blue">{v}</p>
    </div>
  );
}
