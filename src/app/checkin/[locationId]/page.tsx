import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { verifyVenueKey } from "@/lib/checkin";
import { CheckInForm } from "./checkin-form";

export const dynamic = "force-dynamic";

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { locationId } = await params;
  const { k } = await searchParams;

  const location = await db.location.findUnique({
    where: { id: locationId },
    include: { business: true },
  });
  if (!location) notFound();

  const keyValid = verifyVenueKey(location.id, location.checkInSecret, k);

  return (
    <main className="min-h-dvh bg-stone-900 text-stone-50">
      <div className="mx-auto w-full max-w-sm px-5 py-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
          {location.business.name}
        </p>
        <h1 className="mt-2 font-serif text-3xl">Bine ați venit</h1>

        {keyValid ? (
          <CheckInForm
            locationId={location.id}
            venueKey={k!}
            gracePeriodMin={location.business.gracePeriodMin}
          />
        ) : (
          <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
            <p className="text-sm leading-relaxed text-amber-200">
              Acest link nu este valid. Scanați codul QR afișat la intrare, sau
              cereți ajutor personalului.
            </p>
          </div>
        )}

        <p className="mt-12 text-center text-xs text-stone-600">Tenuto</p>
      </div>
    </main>
  );
}
