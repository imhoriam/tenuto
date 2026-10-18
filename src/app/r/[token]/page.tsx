import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { Logo } from "@/components/logo";
import { label } from "@/components/ui";
import { db } from "@/lib/db";
import { BOOKING_STATUS, CHARGE_STATUS, DISPUTE_STATUS, PAYOUT_STATUS } from "@/lib/constants";
import { dayIn, money, timeIn } from "@/lib/format";
import { publicBaseUrl } from "@/lib/origin";
import { DisputeForm } from "./dispute-form";

export const dynamic = "force-dynamic";

// A personal page: never indexed.
export const metadata: Metadata = {
  title: "Rezervarea ta",
  robots: { index: false, follow: false },
};

const STATUS_LINE: Record<string, string> = {
  [BOOKING_STATUS.CONFIRMED]: "Confirmată — te așteptăm.",
  [BOOKING_STATUS.CHECKED_IN]: "Ai fost la restaurant. Nu se percepe nicio taxă.",
  [BOOKING_STATUS.COMPLETED]: "Încheiată. Nu se percepe nicio taxă.",
  [BOOKING_STATUS.CANCELLED_FREE]: "Anulată la timp. Nu se percepe nicio taxă.",
  [BOOKING_STATUS.CANCELLED_LATE]: "Anulată după termenul gratuit.",
  [BOOKING_STATUS.NO_SHOW_PENDING]: "Sosirea nu a fost confirmată în perioada de toleranță.",
  [BOOKING_STATUS.CHARGE_SUCCEEDED]: "Taxa de neprezentare a fost încasată.",
  [BOOKING_STATUS.CHARGE_FAILED]: "Taxa nu a putut fi încasată de pe card.",
  [BOOKING_STATUS.WAIVED]: "Taxa a fost anulată. Nu datorezi nimic.",
  [BOOKING_STATUS.DISPUTED]: "Ai contestat taxa. Banii sunt blocați până la rezolvare.",
};

export default async function CustomerBookingPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  if (token.length < 16) notFound();

  const booking = await db.booking.findUnique({
    where: { accessToken: token },
    include: {
      business: true,
      service: { select: { usesPartySize: true } },
      location: true,
      customer: true,
      mandate: true,
      policySnapshot: true,
      charges: { orderBy: { attempt: "desc" } },
      dispute: true,
    },
  });
  if (!booking) notFound();

  const b = booking.business;
  const tz = b.timezone;
  const grace = booking.policySnapshot?.gracePeriodMin ?? b.gracePeriodMin;
  const charge = booking.charges.find((c) => c.status === CHARGE_STATUS.SUCCEEDED || c.status === CHARGE_STATUS.REFUNDED);
  const now = new Date();
  const canDispute =
    booking.status === BOOKING_STATUS.CHARGE_SUCCEEDED &&
    !booking.dispute &&
    charge?.payoutStatus === PAYOUT_STATUS.HELD &&
    charge.payoutReleaseAt !== null &&
    now <= charge.payoutReleaseAt;

  // The host scans this on arrival. It opens the booking inside the
  // restaurant's own account, so it confirms nothing when anyone else scans it.
  const showPass = booking.status === BOOKING_STATUS.CONFIRMED || booking.status === BOOKING_STATUS.NO_SHOW_PENDING;
  const qr = showPass
    ? await QRCode.toString(`${await publicBaseUrl()}/sosire/${token}`, {
        type: "svg",
        margin: 0,
        errorCorrectionLevel: "M",
        color: { dark: "#15193b", light: "#fffcf5" },
      })
    : null;

  return (
    <main className="min-h-dvh">
      <header className="border-b-2 border-blue">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between px-4">
          <Link href="/" aria-label="Tenuto">
            <Logo className="scale-90" />
          </Link>
          <span className="font-mono text-xs font-semibold tracking-[0.2em] text-blue">{booking.reference}</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-10">
        <p className={`${label} text-pink-deep`}>Rezervarea lui {booking.customer.name.split(" ")[0]}</p>
        <h1 className="mt-2 text-5xl font-bold leading-[0.95] tracking-[-0.05em] text-blue">{b.name}</h1>
        <p className="mt-3 text-lg text-ink">
          <span className="capitalize">{dayIn(booking.startAt, tz)}</span> · <b>{timeIn(booking.startAt, tz)}</b>
          {booking.service.usesPartySize ? ` · ${booking.partySize} ${booking.partySize === 1 ? "persoană" : "persoane"}` : null}
        </p>

        <p className="mt-6 rounded-md border-2 border-blue bg-sheet px-4 py-3 font-semibold text-blue">
          {STATUS_LINE[booking.status] ?? booking.status}
        </p>

        {qr ? (
          <section className="relative mt-6">
            <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-lg bg-pink" aria-hidden="true" />
            <div className="relative rounded-lg border-2 border-blue bg-sheet p-6 text-center">
              <p className={`${label} text-blue`}>La sosire, arată codul</p>
              <div
                className="mx-auto mt-4 w-60 max-w-full [&>svg]:h-auto [&>svg]:w-full"
                role="img"
                aria-label={`Cod QR pentru rezervarea ${booking.reference}`}
                // qrcode renders a self-contained SVG from our own URL.
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <p className="mt-4 font-mono text-lg font-bold tracking-[0.3em] text-blue">{booking.reference}</p>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
                Personalul îl scanează și sosirea ta e înregistrată, cu ora exactă. Nu merge scanarea? Spune numele:{" "}
                <b className="text-ink">{booking.customer.name}</b>.
              </p>
            </div>
          </section>
        ) : null}

        {/* The fee, and the customer's recourse */}
        {charge ? (
          <section className="relative mt-6">
            <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-lg bg-blue" aria-hidden="true" />
            <div className="relative rounded-lg border-2 border-blue bg-sheet p-5">
              <p className={`${label} text-muted`}>Taxă de neprezentare</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-blue">{money(charge.amountCents, charge.currency)}</p>
              <p className="mt-1 text-sm text-muted">
                Încasată pe {charge.succeededAt ? dayIn(charge.succeededAt, tz) : "—"}
                {booking.mandate?.cardLast4 ? ` de pe cardul ••${booking.mandate.cardLast4}` : ""}.
              </p>

              <div className="mt-5 border-t-2 border-dashed border-blue/30 pt-5">
                {charge.status === CHARGE_STATUS.REFUNDED ? (
                  <p className="text-[15px] text-ink">
                    <b className="text-emerald-800">Rambursată integral</b>
                    {charge.refundedAt ? ` pe ${dayIn(charge.refundedAt, tz)}` : ""}. Banii ajung înapoi pe card în câteva zile
                    lucrătoare, în funcție de bancă.
                  </p>
                ) : booking.dispute?.status === DISPUTE_STATUS.OPEN ? (
                  <p className="text-[15px] leading-relaxed text-ink">
                    Ai contestat taxa pe {dayIn(booking.dispute.openedAt, tz)}. Banii sunt blocați și nu ajung la restaurant.
                    Restaurantul îi poate rambursa oricând; altfel, Tenuto verifică istoricul rezervării și decide.
                  </p>
                ) : booking.dispute?.status === DISPUTE_STATUS.UPHELD ? (
                  <p className="text-[15px] leading-relaxed text-ink">
                    Tenuto a verificat contestația și taxa rămâne.
                    {booking.dispute.resolution ? ` Motiv: „${booking.dispute.resolution}”.` : ""} Îți păstrezi dreptul de a
                    contesta tranzacția la banca ta.
                  </p>
                ) : canDispute ? (
                  <DisputeForm
                    token={token}
                    amount={money(charge.amountCents, charge.currency)}
                    until={dayIn(charge.payoutReleaseAt!, tz)}
                  />
                ) : (
                  <p className="text-[15px] leading-relaxed text-ink">
                    Termenul de contestare prin Tenuto a trecut. Poți contesta tranzacția direct la banca ta.
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-8 space-y-4 text-sm">
          <Block title="Ce ai acceptat la rezervare">
            <p className="leading-relaxed text-ink">„{booking.policySnapshot?.policyText ?? "Fără condiții speciale."}”</p>
            <p className="mt-2 text-muted">
              Toleranță: {grace} minute după ora rezervării. Acceptat pe{" "}
              {booking.policySnapshot ? dayIn(booking.policySnapshot.acceptedAt, tz) : "—"}. Textul nu mai poate fi modificat de
              nimeni.
            </p>
          </Block>

          {booking.status === BOOKING_STATUS.CONFIRMED ? (
            <Block title="Nu mai poți ajunge?">
              <p className="leading-relaxed text-ink">
                Anunță restaurantul — anularea e gratuită până cu{" "}
                {booking.policySnapshot?.cancellationWindowHours ?? b.cancellationWindowHours} h înainte, iar masa ajunge la
                altcineva.
              </p>
            </Block>
          ) : null}

          <Block title="Unde">
            <p className="font-semibold text-ink">{b.name}</p>
            <p className="text-ink">
              {[booking.location?.address, booking.location?.city].filter(Boolean).join(", ") || "—"}
            </p>
            {booking.location?.address ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [b.name, booking.location.address, booking.location.city].filter(Boolean).join(", "),
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 mr-4 inline-block font-semibold text-blue underline decoration-pink decoration-2 underline-offset-4"
              >
                Deschide în hartă →
              </a>
            ) : null}
            {b.phone ? (
              <a
                href={`tel:${b.phone.replace(/\s/g, "")}`}
                className="mt-2 inline-block font-semibold text-blue underline decoration-pink decoration-2 underline-offset-4"
              >
                {b.phone}
              </a>
            ) : null}
          </Block>
        </section>

        <p className="mt-10 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          <Link href="/legal/politica-neprezentare" className="hover:text-blue">
            Politica de neprezentare
          </Link>
          {" · "}
          <Link href="/legal/termeni" className="hover:text-blue">
            Termeni
          </Link>
        </p>
      </div>
    </main>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-2 border-blue/30 bg-sheet p-5">
      <p className={`${label} mb-2 text-blue`}>{title}</p>
      {children}
    </div>
  );
}
