import { db } from "@/lib/db";
import { CHANNEL } from "@/lib/constants";
import { shortDayIn, timeIn } from "@/lib/format";
import { confirmationSms, toE164 } from "./messages";
import { smsProvider, type SmsProvider } from "./sms";

/**
 * Text the customer their confirmation: where, when, how long the table is
 * held, and the link to their booking page (which shows the QR the host
 * scans on arrival).
 *
 * Never throws. A failed SMS must not undo a booking the customer has already
 * seen confirmed on screen; the failure is recorded on the Notification row
 * and the confirmation screen still shows the same link.
 */
export async function sendBookingConfirmation(params: {
  bookingId: string;
  baseUrl: string;
  provider?: SmsProvider;
}) {
  const provider = params.provider ?? smsProvider();

  const booking = await db.booking.findUnique({
    where: { id: params.bookingId },
    include: { business: true, service: { select: { usesPartySize: true } }, location: true, customer: true, policySnapshot: true },
  });
  if (!booking?.accessToken) return null;

  const tz = booking.business.timezone;
  const loc = booking.location;
  const body = confirmationSms({
    businessName: booking.business.name,
    when: `${shortDayIn(booking.startAt, tz)}, ${timeIn(booking.startAt, tz)}`,
    partySize: booking.service.usesPartySize ? booking.partySize : null,
    address: loc?.address ? [loc.address, loc.city].filter(Boolean).join(", ") : null,
    gracePeriodMin: booking.policySnapshot?.gracePeriodMin ?? booking.business.gracePeriodMin,
    url: `${params.baseUrl.replace(/\/$/, "")}/r/${booking.accessToken}`,
  });

  const channel = provider.name === "console" ? CHANNEL.CONSOLE : CHANNEL.SMS;
  const notification = await db.notification.create({
    data: { bookingId: booking.id, channel, template: "confirmation", body, status: "queued" },
  });

  const to = toE164(booking.customer.phone);
  const result = to ? await provider.send({ to, body }) : { ok: false as const, error: `invalid phone: ${booking.customer.phone}` };

  return db.notification.update({
    where: { id: notification.id },
    data: result.ok
      ? { status: "sent", sentAt: new Date(), providerRef: result.providerRef }
      : { status: "failed", error: result.error },
  });
}
