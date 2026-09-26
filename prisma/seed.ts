/**
 * Demo seed: one restaurant, mid-service.
 *
 * Bookings are generated relative to the moment you run this, so the dashboard
 * always looks like a live service rather than a museum piece. Re-run before a
 * demo: `npm run db:seed`.
 */
import { TZDate } from "@date-fns/tz";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import "dotenv/config";

import { nanoid } from "nanoid";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  ACTOR,
  BOOKING_STATUS,
  CHANNEL,
  CHARGE_STATUS,
  CHECKIN_METHOD,
  DISPUTE_WINDOW_DAYS,
  PAYOUT_STATUS,
  MANDATE_STATUS,
  REQUIREMENT,
  RESOURCE_KIND,
  VERTICAL,
} from "../src/lib/constants";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  }),
});

const MIN = 60_000;
const HOUR = 60 * MIN;

const TIMEZONE = "Europe/Bucharest";

/** Demo login for the seeded restaurant. Shown on /login outside production. */
const DEMO_LOGIN = { loginName: "hanul-cu-tei", password: "tenuto-demo" };
/** Open for lunch and dinner, Tue–Sun. Closed Monday. */
const OPEN_MINUTE = 12 * 60;
const CLOSE_MINUTE = 23 * 60;
const OPEN_WEEKDAYS = [0, 2, 3, 4, 5, 6]; // 1 = Monday, closed

/**
 * Where "now" sits for the purposes of staging the demo.
 *
 * Anchoring bookings to wall-clock time breaks the demo in two different ways
 * depending on when you run it: seed at 01:00 and you get bookings at 03:00 for
 * a restaurant that shuts at 23:00, which no operator will believe.
 *
 * So: if the real clock is inside service hours, use it — the grace-period
 * countdown and the "mark absent" button are then genuinely live, which is the
 * part worth showing. Outside service hours, fall back to the most recent
 * evening at 21:00 so the data stays coherent.
 */
function resolveAnchor(): { anchor: Date; live: boolean } {
  const now = new Date();
  const local = new TZDate(now.getTime(), TIMEZONE);
  const minuteOfDay = local.getHours() * 60 + local.getMinutes();

  const insideService =
    OPEN_WEEKDAYS.includes(local.getDay()) &&
    minuteOfDay >= OPEN_MINUTE + 30 &&
    minuteOfDay <= CLOSE_MINUTE - 30;

  if (insideService) return { anchor: now, live: true };

  // Walk back to the most recent open day and put us at 21:00, mid-service.
  const cursor = new TZDate(now.getTime(), TIMEZONE);
  for (let back = 0; back < 8; back += 1) {
    const day = new TZDate(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() - back,
      21,
      0,
      0,
      TIMEZONE,
    );
    if (OPEN_WEEKDAYS.includes(day.getDay()) && day.getTime() <= now.getTime()) {
      return { anchor: new Date(day.getTime()), live: false };
    }
  }
  return { anchor: now, live: false };
}

const { anchor: NOW, live: LIVE_SERVICE } = resolveAnchor();
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

/**
 * The next open day at a given local time. Used for the "upcoming" demo
 * bookings so they land on a start the availability engine would actually
 * offer — a 2h dinner cannot start at 23:00 in a kitchen that closes at 23:00.
 */
function nextOpenDayAt(hour: number, minute: number, fromDaysAhead = 0): Date {
  const base = new TZDate(NOW.getTime(), TIMEZONE);
  for (let ahead = fromDaysAhead; ahead < 10; ahead += 1) {
    const day = new TZDate(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + ahead,
      hour,
      minute,
      0,
      TIMEZONE,
    );
    if (OPEN_WEEKDAYS.includes(day.getDay()) && day.getTime() > NOW.getTime()) {
      return new Date(day.getTime());
    }
  }
  return new Date(NOW.getTime() + 24 * HOUR);
}


/** TNT-XXXXX booking reference. */
function reference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  let out = "";
  for (let i = 0; i < 5; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `TNT-${out}`;
}

async function main() {
  console.log("Resetting demo data…");
  // Order matters: children first. onDelete: Cascade covers most of it, but
  // being explicit keeps this readable.
  await db.notification.deleteMany();
  await db.bookingEvent.deleteMany();
  await db.checkIn.deleteMany();
  await db.charge.deleteMany();
  await db.mandate.deleteMany();
  await db.policySnapshot.deleteMany();
  await db.booking.deleteMany();
  await db.customerProfile.deleteMany();
  await db.customer.deleteMany();
  await db.policyRule.deleteMany();
  await db.timeOff.deleteMany();
  await db.scheduleRule.deleteMany();
  await db.service.deleteMany();
  await db.resource.deleteMany();
  await db.location.deleteMany();
  await db.business.deleteMany();

  // --- the restaurant -------------------------------------------------------
  const business = await db.business.create({
    data: {
      slug: "hanul-cu-tei",
      name: "Hanul cu Tei",
      vertical: VERTICAL.RESTAURANT,
      timezone: TIMEZONE,
      currency: "RON",
      email: "rezervari@hanulcutei.example",
      phone: "+40 721 000 000",
      subscriptionStatus: "active",
      cancellationWindowHours: 24,
      noShowFeeCents: 5000, // 50 RON
      gracePeriodMin: 15,
      category: "Restaurant românesc",
      description:
        "Bucătărie românească de casă în inima Centrului Vechi. Ciorbă de burtă, sarmale cu mămăligă și papanași ca la bunica, sub teii din curtea interioară.",
      website: "https://hanulcutei.example",
      priceLevel: 2,
      legalName: "Hanul cu Tei S.R.L.",
      taxId: "14399840", // a checksum-valid CUI; demo data
      tradeRegisterNo: "J40/1234/2015",
      registeredAddress: "Strada Lipscani 12, Sector 3, București",
      vatPayer: true,
      published: true,
    },
  });

  await db.account.create({
    data: {
      loginName: DEMO_LOGIN.loginName,
      passwordHash: await hashPassword(DEMO_LOGIN.password),
      businessId: business.id,
    },
  });

  const location = await db.location.create({
    data: {
      businessId: business.id,
      name: "Centru Vechi",
      address: "Strada Lipscani 12",
      city: "București",
      county: "București",
      postalCode: "030033",
      lat: 44.4310,
      lng: 26.1010,
    },
  });

  // --- tables ---------------------------------------------------------------
  const tableSpecs = [
    { name: "T1", capacity: 2 },
    { name: "T2", capacity: 2 },
    { name: "T3", capacity: 4 },
    { name: "T4", capacity: 4 },
    { name: "T5", capacity: 6 },
    { name: "T6", capacity: 8 },
  ];

  const tables = [];
  for (const spec of tableSpecs) {
    tables.push(
      await db.resource.create({
        data: {
          businessId: business.id,
          locationId: location.id,
          name: spec.name,
          kind: RESOURCE_KIND.TABLE,
          capacity: spec.capacity,
        },
      }),
    );
  }

  // --- service --------------------------------------------------------------
  const dinner = await db.service.create({
    data: {
      businessId: business.id,
      name: "Cină",
      description: "Masă rezervată pentru 2 ore.",
      durationMin: 120,
      bufferAfterMin: 15, // reset the table
      usesPartySize: true,
      priceCents: 0,
    },
  });

  // --- opening hours: Tue–Sun 18:00–23:00, closed Monday --------------------
  for (const weekday of OPEN_WEEKDAYS) {
    await db.scheduleRule.create({
      data: {
        businessId: business.id,
        resourceId: null,
        weekday,
        startMinute: OPEN_MINUTE,
        endMinute: CLOSE_MINUTE,
      },
    });
  }

  // --- risk-based policy ----------------------------------------------------
  // First match by ascending priority wins.
  await db.policyRule.createMany({
    data: [
      {
        businessId: business.id,
        name: "Regulars book free",
        priority: 10,
        minCompletedHere: 3,
        requirement: REQUIREMENT.NONE,
      },
      {
        businessId: business.id,
        name: "Previous no-show pays a deposit",
        priority: 20,
        hasNoShowHistory: true,
        requirement: REQUIREMENT.DEPOSIT,
        feeCentsOverride: 10000, // 100 RON
      },
      {
        businessId: business.id,
        name: "Large parties leave a card",
        priority: 30,
        minPartySize: 6,
        requirement: REQUIREMENT.CARD_ON_FILE,
        feeCentsOverride: 15000, // 150 RON — a six-top hurts more
      },
      {
        businessId: business.id,
        name: "Everyone else leaves a card",
        priority: 100,
        requirement: REQUIREMENT.CARD_ON_FILE,
      },
    ],
  });

  // --- customers ------------------------------------------------------------
  const regular = await db.customer.create({
    data: {
      phone: "+40721111111",
      name: "Andreea Pop",
      email: "andreea@example.com",
      completedCount: 6,
      profiles: {
        create: { businessId: business.id, completedCount: 5, trusted: true },
      },
    },
  });

  const firstTimer = await db.customer.create({
    data: {
      phone: "+40722222222",
      name: "Mihai Ionescu",
      profiles: { create: { businessId: business.id } },
    },
  });

  const burned = await db.customer.create({
    data: {
      phone: "+40723333333",
      name: "Radu Georgescu",
      completedCount: 1,
      noShowCount: 2,
      profiles: {
        create: { businessId: business.id, completedCount: 1, noShowCount: 2 },
      },
    },
  });

  const largeParty = await db.customer.create({
    data: {
      phone: "+40724444444",
      name: "Elena Marinescu",
      completedCount: 2,
      profiles: { create: { businessId: business.id, completedCount: 2 } },
    },
  });

  // --- bookings, staged around "now" ---------------------------------------
  type Stage = {
    customer: { id: string };
    table: { id: string };
    partySize: number;
    startOffsetMs?: number;
    startAtAbsolute?: Date;
    status: string;
    requirement: string;
    feeCents: number;
    checkedInOffsetMs?: number;
    noShowMarkedOffsetMs?: number;
    chargeStatus?: string;
    note?: string;
    /** For collected fees: where the money is, and the customer's dispute. */
    payoutStatus?: string;
    disputeReason?: string;
  };

  const stages: Stage[] = [
    {
      // Seated an hour ago, still eating. Nothing collectable.
      customer: regular,
      table: tables[0],
      partySize: 2,
      startOffsetMs: -1 * HOUR,
      status: BOOKING_STATUS.CHECKED_IN,
      requirement: REQUIREMENT.NONE,
      feeCents: 0,
      checkedInOffsetMs: -55 * MIN,
      note: "Masă lângă fereastră, vă rog.",
    },
    {
      // 25 minutes late, grace window blown. Opening the dashboard records the
      // no-show automatically, frees the table and makes the fee collectable.
      customer: firstTimer,
      table: tables[2],
      partySize: 4,
      startOffsetMs: -25 * MIN,
      status: BOOKING_STATUS.CONFIRMED,
      requirement: REQUIREMENT.CARD_ON_FILE,
      feeCents: 5000,
    },
    {
      // 5 minutes late — inside the 15 minute hold, cannot be marked yet.
      customer: largeParty,
      table: tables[4],
      partySize: 6,
      startOffsetMs: -5 * MIN,
      status: BOOKING_STATUS.CONFIRMED,
      requirement: REQUIREMENT.CARD_ON_FILE,
      feeCents: 15000,
    },
    {
      // Already marked absent earlier tonight; charge window running.
      customer: burned,
      table: tables[1],
      partySize: 2,
      startOffsetMs: -3 * HOUR,
      status: BOOKING_STATUS.NO_SHOW_PENDING,
      requirement: REQUIREMENT.DEPOSIT,
      feeCents: 10000,
      noShowMarkedOffsetMs: -2 * HOUR - 45 * MIN,
    },
    {
      // Last week: absent, charged, money recovered. Feeds the ROI panel.
      customer: burned,
      table: tables[3],
      partySize: 4,
      startOffsetMs: -7 * 24 * HOUR,
      status: BOOKING_STATUS.CHARGE_SUCCEEDED,
      requirement: REQUIREMENT.CARD_ON_FILE,
      feeCents: 5000,
      noShowMarkedOffsetMs: -7 * 24 * HOUR + 20 * MIN,
      chargeStatus: CHARGE_STATUS.SUCCEEDED,
      payoutStatus: PAYOUT_STATUS.RELEASED,
    },
    {
      // Two days ago: absent, charged, money still held — the customer can
      // still dispute it from their booking page.
      customer: firstTimer,
      table: tables[2],
      partySize: 2,
      startOffsetMs: -2 * 24 * HOUR,
      status: BOOKING_STATUS.CHARGE_SUCCEEDED,
      requirement: REQUIREMENT.CARD_ON_FILE,
      feeCents: 5000,
      noShowMarkedOffsetMs: -2 * 24 * HOUR + 16 * MIN,
      chargeStatus: CHARGE_STATUS.SUCCEEDED,
      payoutStatus: PAYOUT_STATUS.HELD,
    },
    {
      // Three days ago: charged, and the customer says they were there.
      // The money is frozen until the restaurant refunds or Tenuto decides.
      customer: largeParty,
      table: tables[4],
      partySize: 4,
      startOffsetMs: -3 * 24 * HOUR,
      status: BOOKING_STATUS.DISPUTED,
      requirement: REQUIREMENT.CARD_ON_FILE,
      feeCents: 5000,
      noShowMarkedOffsetMs: -3 * 24 * HOUR + 16 * MIN,
      chargeStatus: CHARGE_STATUS.SUCCEEDED,
      payoutStatus: PAYOUT_STATUS.FROZEN,
      disputeReason: "Am ajuns la 20:10 și am stat la masă, dar nimeni nu a marcat sosirea.",
    },
    {
      // Upcoming tonight.
      customer: regular,
      table: tables[3],
      partySize: 4,
      startAtAbsolute: nextOpenDayAt(19, 0),
      status: BOOKING_STATUS.CONFIRMED,
      requirement: REQUIREMENT.NONE,
      feeCents: 0,
    },
    {
      // Tomorrow, large party, card on file.
      customer: largeParty,
      table: tables[5],
      partySize: 8,
      startAtAbsolute: nextOpenDayAt(20, 30, 1),
      status: BOOKING_STATUS.CONFIRMED,
      requirement: REQUIREMENT.CARD_ON_FILE,
      feeCents: 15000,
      note: "Aniversare — tort la final.",
    },
  ];

  for (const stage of stages) {
    const startAt =
      stage.startAtAbsolute ?? at(stage.startOffsetMs ?? 0);
    const endAt = new Date(startAt.getTime() + dinner.durationMin * MIN);
    const occupiedEnd = new Date(
      endAt.getTime() + dinner.bufferAfterMin * MIN,
    );

    const policyText =
      stage.requirement === REQUIREMENT.NONE
        ? "Sunteți client fidel — nu este necesar un card."
        : `Dacă nu ajungeți sau anulați cu mai puțin de ${business.cancellationWindowHours}h înainte, veți fi taxat cu ${(stage.feeCents / 100).toFixed(0)} RON. Masa este ținută ${business.gracePeriodMin} minute după ora rezervării.`;

    const booking = await db.booking.create({
      data: {
        reference: reference(),
        accessToken: nanoid(24),
        businessId: business.id,
        serviceId: dinner.id,
        resourceId: stage.table.id,
        locationId: location.id,
        customerId: stage.customer.id,
        startAt,
        endAt: occupiedEnd,
        partySize: stage.partySize,
        status: stage.status,
        requirement: stage.requirement,
        feeCents: stage.feeCents,
        customerNote: stage.note,
        confirmedAt: new Date(startAt.getTime() - 3 * 24 * HOUR),
        checkedInAt:
          stage.checkedInOffsetMs !== undefined
            ? at(stage.checkedInOffsetMs)
            : null,
        noShowMarkedAt:
          stage.noShowMarkedOffsetMs !== undefined
            ? at(stage.noShowMarkedOffsetMs)
            : null,
        chargeableAt:
          stage.noShowMarkedOffsetMs !== undefined && stage.status === BOOKING_STATUS.NO_SHOW_PENDING
            ? at(stage.noShowMarkedOffsetMs)
            : null,
        policySnapshot: {
          create: {
            policyText,
            feeCents: stage.feeCents,
            currency: business.currency,
            cancellationWindowHours: business.cancellationWindowHours,
            gracePeriodMin: business.gracePeriodMin,
            acceptedAt: new Date(startAt.getTime() - 3 * 24 * HOUR),
            ipAddress: "192.0.2.10",
            userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
          },
        },
      },
    });

    if (stage.requirement !== REQUIREMENT.NONE) {
      await db.mandate.create({
        data: {
          bookingId: booking.id,
          customerId: stage.customer.id,
          provider: "mock",
          paymentMethodRef: `pm_mock_${booking.id.slice(-8)}`,
          setupIntentRef: `seti_mock_${booking.id.slice(-8)}`,
          status: MANDATE_STATUS.ACTIVE,
          cardBrand: "visa",
          cardLast4: "4242",
          cardExpMonth: 12,
          cardExpYear: 2029,
          threeDSPassed: true,
        },
      });
    }

    if (stage.checkedInOffsetMs !== undefined) {
      await db.checkIn.create({
        data: {
          bookingId: booking.id,
          method: CHECKIN_METHOD.MANUAL,
          at: at(stage.checkedInOffsetMs),
          actorLabel: "staff",
        },
      });
    }

    if (stage.chargeStatus) {
      await db.charge.create({
        data: {
          bookingId: booking.id,
          amountCents: stage.feeCents,
          currency: business.currency,
          status: stage.chargeStatus,
          idempotencyKey: `noshow_${booking.id}_1`,
          provider: "mock",
          providerRef: `pi_mock_${booking.id.slice(-8)}`,
          succeededAt:
            stage.chargeStatus === CHARGE_STATUS.SUCCEEDED ? at(stage.noShowMarkedOffsetMs!) : null,
          payoutStatus: stage.payoutStatus ?? PAYOUT_STATUS.RELEASED,
          payoutReleaseAt: new Date(at(stage.noShowMarkedOffsetMs!).getTime() + DISPUTE_WINDOW_DAYS * 24 * HOUR),
        },
      });
    }

    if (stage.disputeReason) {
      await db.dispute.create({
        data: { bookingId: booking.id, reason: stage.disputeReason, openedAt: at(-1 * 24 * HOUR) },
      });
    }

    await db.bookingEvent.create({
      data: {
        bookingId: booking.id,
        fromStatus: null,
        toStatus: stage.status,
        actorType: ACTOR.SYSTEM,
        reason: "seeded",
      },
    });

    await db.notification.create({
      data: {
        bookingId: booking.id,
        channel: CHANNEL.CONSOLE,
        template: "confirmation",
        body: `Rezervarea ${booking.reference} la ${business.name} este confirmată.`,
        status: "sent",
        sentAt: new Date(startAt.getTime() - 3 * 24 * HOUR),
      },
    });
  }

  await seedNeighbours();

  const counts = {
    businesses: await db.business.count(),
    tables: await db.resource.count(),
    policyRules: await db.policyRule.count(),
    customers: await db.customer.count(),
    bookings: await db.booking.count(),
  };

  console.log("Seeded:", counts);
  console.log(
    LIVE_SERVICE
      ? "Anchored to the live clock — grace countdowns are real."
      : `Outside service hours; anchored to ${NOW.toISOString()} so the data stays coherent.`,
  );
  console.log(`\nBooking page:  /book/${business.slug}`);
  console.log(`Dashboard:     /dashboard/${business.slug}  (${DEMO_LOGIN.loginName} / ${DEMO_LOGIN.password})`);
  const held = await db.booking.findFirst({
    where: { businessId: business.id, status: BOOKING_STATUS.CHARGE_SUCCEEDED, charges: { some: { payoutStatus: PAYOUT_STATUS.HELD } } },
  });
  if (held?.accessToken) console.log(`Disputable:    /r/${held.accessToken}  (a held fee the customer can contest)`);
  console.log(`Admin:         /admin  (set TENUTO_ADMIN_PASSWORD; user "tenuto")`);
}

/**
 * A few more published restaurants so public search has something to search.
 * No bookings — they exist to be found and booked.
 */
async function seedNeighbours() {
  const venues = [
    {
      slug: "osteria-del-porto",
      name: "Osteria del Porto",
      category: "Restaurant italian",
      city: "Cluj-Napoca",
      county: "Cluj",
      address: "Strada Iuliu Maniu 8",
      postalCode: "400095",
      priceLevel: 3,
      description: "Paste făcute în casă, peste proaspăt de două ori pe săptămână și o pivniță de vinuri din Piemont și Sicilia.",
      tables: [2, 2, 2, 4, 4, 6],
      hours: [{ days: [2, 3, 4, 5, 6, 0], open: 12 * 60, close: 23 * 60 }],
    },
    {
      slug: "bistro-sfatului",
      name: "Bistro Sfatului",
      category: "Bistro",
      city: "Brașov",
      county: "Brașov",
      address: "Piața Sfatului 14",
      postalCode: "500031",
      priceLevel: 2,
      description: "Mic dejun toată ziua, prânz rapid și cină cu vedere spre Tâmpa. Terasă deschisă din aprilie până în octombrie.",
      tables: [2, 2, 4, 4, 4, 8],
      hours: [{ days: [1, 2, 3, 4, 5, 6, 0], open: 9 * 60, close: 22 * 60 }],
    },
    {
      slug: "sushi-kaiten-timisoara",
      name: "Kaiten",
      category: "Restaurant de sushi",
      city: "Timișoara",
      county: "Timiș",
      address: "Strada Alba Iulia 2",
      postalCode: "300077",
      priceLevel: 3,
      description: "Omakase la bar pentru opt persoane și meniu à la carte în sală. Vinerea și sâmbăta deschis până la 01:00.",
      tables: [2, 2, 2, 2, 4, 4],
      hours: [
        { days: [2, 3, 4, 0], open: 18 * 60, close: 23 * 60 },
        { days: [5, 6], open: 18 * 60, close: 25 * 60 }, // past midnight, see CLAUDE.md §11
      ],
    },
  ];

  for (const v of venues) {
    const business = await db.business.create({
      data: {
        slug: v.slug,
        name: v.name,
        vertical: VERTICAL.RESTAURANT,
        timezone: TIMEZONE,
        currency: "RON",
        category: v.category,
        description: v.description,
        priceLevel: v.priceLevel,
        phone: "+40 700 000 000",
        legalName: `${v.name} S.R.L.`,
        taxId: "14399840",
        tradeRegisterNo: "J12/100/2020",
        registeredAddress: `${v.address}, ${v.city}`,
        published: true,
        locations: {
          create: { name: "Principal", address: v.address, city: v.city, county: v.county, postalCode: v.postalCode },
        },
        services: {
          create: { name: "Masă", description: "Masă rezervată pentru 2 ore.", durationMin: 120, bufferAfterMin: 15, usesPartySize: true },
        },
        policyRules: {
          create: [
            { name: "Clienții fideli rezervă fără card", priority: 10, minCompletedHere: 3, requirement: REQUIREMENT.NONE },
            { name: "Toți ceilalți lasă card", priority: 100, requirement: REQUIREMENT.CARD_ON_FILE },
          ],
        },
      },
      include: { locations: true },
    });

    await db.resource.createMany({
      data: v.tables.map((capacity, i) => ({
        businessId: business.id,
        locationId: business.locations[0].id,
        name: `M${i + 1}`,
        kind: RESOURCE_KIND.TABLE,
        capacity,
      })),
    });

    await db.scheduleRule.createMany({
      data: v.hours.flatMap((h) =>
        h.days.map((weekday) => ({ businessId: business.id, weekday, startMinute: h.open, endMinute: h.close })),
      ),
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
