import { TZDate } from "@date-fns/tz";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/logo";
import { label } from "@/components/ui";
import { VenueCover } from "@/components/venue-cover";
import { PRICE_LEVELS, describeDay, openStatus } from "@/lib/business-profile";
import { getBookingPageData } from "@/lib/booking/slots";
import { isoDateIn } from "@/lib/format";
import { BookingForm } from "./booking-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/book/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBookingPageData(slug);
  return business
    ? { title: `Rezervă la ${business.name}`, description: business.description ?? `Rezervă o masă la ${business.name}.` }
    : {};
}

export default async function BookPage({ params }: PageProps<"/book/[slug]">) {
  const { slug } = await params;
  const business = await getBookingPageData(slug);
  if (!business) notFound();

  const service = business.services[0];
  const loc = business.locations[0];
  const today = isoDateIn(new Date(), business.timezone);
  const local = new TZDate(new Date().getTime(), business.timezone);
  const status = openStatus(
    business.scheduleRules.filter((r) => r.resourceId === null),
    { weekday: local.getDay(), minute: local.getHours() * 60 + local.getMinutes() },
  );
  const price = PRICE_LEVELS.find((p) => p.value === business.priceLevel);
  const bookable =
    !business.suspendedAt && Boolean(service) && business.resources.length > 0 && business.scheduleRules.length > 0;

  return (
    <main className="min-h-dvh">
      <header className="border-b-2 border-blue bg-paper">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/restaurants" className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-blue hover:underline hover:decoration-pink hover:decoration-2">
            ← Restaurante
          </Link>
          <Link href="/" aria-label="Tenuto">
            <Logo className="scale-90" />
          </Link>
        </div>
      </header>

      <VenueCover slug={business.slug} name={business.name} className="h-40 border-b-2 border-blue sm:h-52" />

      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 pb-20 sm:px-6 lg:grid-cols-[1fr_20rem]">
        <div className="relative -mt-20 min-w-0 self-start">
          <div className="absolute inset-0 translate-x-2.5 translate-y-2.5 rounded-lg bg-blue" aria-hidden="true" />
          <div className="relative rounded-lg border-2 border-blue bg-sheet p-5 sm:p-8">
            <p className={`${label} text-pink-deep`}>Rezervare</p>
            <h1 className="mt-2 text-4xl font-bold leading-[0.95] tracking-[-0.05em] text-blue sm:text-5xl">{business.name}</h1>
            <p className={`${label} mt-3 text-muted`}>{[business.category, loc?.city, price?.label].filter(Boolean).join(" · ")}</p>

            <div className="mt-8 border-t-2 border-blue pt-8">
              {bookable ? (
                <BookingForm
                  slug={business.slug}
                  service={{
                    id: service!.id,
                    name: service!.name,
                    description: service!.description,
                    durationMin: service!.durationMin,
                  }}
                  businessName={business.name}
                  timezone={business.timezone}
                  today={today}
                  maxCapacity={Math.max(...business.resources.map((r) => r.capacity), 1)}
                />
              ) : (
                <div className="rounded-lg border-2 border-dashed border-blue p-8 text-center">
                  <p className="text-2xl font-bold tracking-tight text-blue">Rezervările nu sunt încă deschise.</p>
                  <p className="mt-2 text-sm text-ink">
                    {business.phone ? `Între timp, puteți suna la ${business.phone}.` : "Reveniți în curând."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="min-w-0 space-y-4 lg:pt-8">
          <div className="rounded-lg border-2 border-blue bg-sheet">
            <p className="flex items-center gap-2 border-b-2 border-blue px-5 py-3 text-sm font-bold text-blue">
              <span className={`h-2.5 w-2.5 rounded-full ${status.open ? "live-dot bg-emerald-500" : "bg-faint"}`} />
              {status.open ? "Deschis acum" : "Închis acum"}
              <span className="ml-auto font-mono text-xs font-normal text-muted">azi {describeDay(status.today)}</span>
            </p>
            {business.description ? <p className="px-5 pt-4 text-[15px] leading-relaxed text-ink">{business.description}</p> : null}
            <dl className="space-y-3 p-5 text-sm">
              {loc?.address ? (
                <div>
                  <dt className={`${label} text-muted`}>Adresă</dt>
                  <dd className="mt-0.5 text-ink">{[loc.address, loc.city].filter(Boolean).join(", ")}</dd>
                </div>
              ) : null}
              {business.phone ? (
                <div>
                  <dt className={`${label} text-muted`}>Telefon</dt>
                  <dd className="mt-0.5">
                    <a href={`tel:${business.phone.replace(/\s/g, "")}`} className="font-semibold text-blue underline decoration-pink decoration-2 underline-offset-4">
                      {business.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {business.website ? (
                <div>
                  <dt className={`${label} text-muted`}>Site</dt>
                  <dd className="mt-0.5">
                    <a href={business.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue underline decoration-pink decoration-2 underline-offset-4">
                      {business.website.replace(/^https?:\/\//, "")}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="relative overflow-hidden rounded-lg border-2 border-blue bg-pink p-5 text-ink">
            <p className="text-xl font-bold leading-tight tracking-tight">0 lei ca să rezervi.</p>
            <p className="mt-2 text-sm leading-relaxed">
              Masa e ținută {business.gracePeriodMin} minute după ora rezervării. Dacă se cere un card, e doar o garanție —
              condițiile exacte le vezi înainte să confirmi.
            </p>
            <Link href="/legal/politica-neprezentare" className="mt-3 inline-block text-sm font-bold underline decoration-blue decoration-2 underline-offset-4">
              Cum funcționează taxa →
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
