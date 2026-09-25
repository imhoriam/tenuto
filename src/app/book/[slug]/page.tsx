import { notFound } from "next/navigation";

import { getBookingPageData } from "@/lib/booking/slots";
import { isoDateIn } from "@/lib/format";
import { BookingForm } from "./booking-form";

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getBookingPageData(slug);
  if (!business) notFound();

  const service = business.services[0];
  if (!service) notFound();

  const today = isoDateIn(new Date(), business.timezone);

  return (
    <main className="min-h-dvh bg-stone-50 text-stone-900">
      <div className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">
            Rezervare
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-tight text-stone-900">
            {business.name}
          </h1>
          {business.locations[0]?.address ? (
            <p className="mt-2 text-sm text-stone-500">
              {business.locations[0].address}
            </p>
          ) : null}
        </header>

        <BookingForm
          slug={business.slug}
          service={{
            id: service.id,
            name: service.name,
            description: service.description,
            durationMin: service.durationMin,
          }}
          timezone={business.timezone}
          today={today}
          maxCapacity={Math.max(...business.resources.map((r) => r.capacity), 1)}
        />

        <footer className="mt-12 border-t border-stone-200 pt-6 text-center text-xs text-stone-400">
          Protejat de <span className="font-medium text-stone-500">Tenuto</span>
        </footer>
      </div>
    </main>
  );
}
