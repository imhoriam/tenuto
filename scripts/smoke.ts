/**
 * End-to-end smoke check against the seeded database.
 *
 * Proves the availability engine and the policy engine agree with what is
 * actually in the DB. Run before a demo: `npm run smoke`.
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { findSlots, resolvePolicyFor } from "../src/lib/booking/slots";
import { pickResource } from "../src/lib/booking/availability";
import { canMarkNoShow } from "../src/lib/booking/state-machine";
import type { BookingStatus } from "../src/lib/constants";

const money = (cents: number, ccy: string) =>
  `${(cents / 100).toFixed(2)} ${ccy}`;

async function main() {
  const business = await db.business.findUniqueOrThrow({
    where: { slug: "hanul-cu-tei" },
    include: { services: true, resources: { orderBy: { capacity: "asc" } } },
  });

  const fmt = new Intl.DateTimeFormat("ro-RO", {
    timeZone: business.timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  console.log(`\n${business.name} — ${business.timezone}`);
  console.log(
    `grace ${business.gracePeriodMin} min · cancel window ${business.cancellationWindowHours}h · default fee ${money(business.noShowFeeCents, business.currency)}`,
  );

  const dinner = business.services[0];
  const from = new Date();
  const to = new Date(from.getTime() + 3 * 24 * 60 * 60 * 1000);

  // --- availability ---------------------------------------------------------
  for (const partySize of [2, 6, 8, 12]) {
    const slots = await findSlots({
      businessId: business.id,
      serviceId: dinner.id,
      partySize,
      from,
      to,
    });

    if (slots.length === 0) {
      console.log(`\nParty of ${partySize}: no availability in the next 3 days`);
      continue;
    }

    const first = slots[0];
    const table = pickResource(
      first,
      business.resources.map((r) => ({ id: r.id, capacity: r.capacity })),
      partySize,
      dinner.usesPartySize,
    );
    const tableName = business.resources.find((r) => r.id === table)?.name;

    console.log(
      `\nParty of ${partySize}: ${slots.length} slots · first ${fmt.format(first.startAt)} → table ${tableName}`,
    );
  }

  // --- policy ---------------------------------------------------------------
  console.log("\nPolicy resolution:");
  const people = await db.customer.findMany({ orderBy: { name: "asc" } });
  const tonight = new Date(Date.now() + 3 * 60 * 60 * 1000);

  for (const person of people) {
    for (const partySize of [2, 6]) {
      const outcome = await resolvePolicyFor({
        businessId: business.id,
        serviceId: dinner.id,
        phone: person.phone,
        partySize,
        startAt: tonight,
      });
      console.log(
        `  ${person.name.padEnd(18)} party ${partySize} → ${outcome.requirement.padEnd(13)} ${money(outcome.feeCents, business.currency).padStart(10)}  (${outcome.matchedRuleName})`,
      );
    }
  }

  // A phone we have never seen must be treated as a first-timer.
  const stranger = await resolvePolicyFor({
    businessId: business.id,
    serviceId: dinner.id,
    phone: "+40799999999",
    partySize: 2,
    startAt: tonight,
  });
  console.log(
    `  ${"(unknown number)".padEnd(18)} party 2 → ${stranger.requirement.padEnd(13)} ${money(stranger.feeCents, business.currency).padStart(10)}  (${stranger.matchedRuleName})`,
  );

  // --- tonight's service ----------------------------------------------------
  console.log("\nTonight's book:");
  const bookings = await db.booking.findMany({
    where: { businessId: business.id },
    include: { customer: true, resource: true },
    orderBy: { startAt: "asc" },
  });

  for (const b of bookings) {
    const check = canMarkNoShow({
      status: b.status as BookingStatus,
      startAt: b.startAt,
      gracePeriodMin: business.gracePeriodMin,
      checkedInAt: b.checkedInAt,
    });
    const action = check.ok ? "CAN MARK ABSENT" : check.reason;

    console.log(
      `  ${fmt.format(b.startAt).padEnd(24)} ${b.resource.name}  ${String(b.partySize).padStart(2)}p  ${b.customer.name.padEnd(18)} ${b.status.padEnd(18)} ${action}`,
    );
  }

  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
