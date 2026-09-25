@AGENTS.md

# Tenuto

Reservation holds with no-show protection. A business installs it; customers
book through a mobile web page with no app and no account. Most bookings never
move money — the card is only charged when someone doesn't turn up.

The name is the musical instruction meaning *held*: the reservation is held,
the deposit is held, the booking is honoured in full.

## What this is not

Not a marketplace. There is no discovery, no browsing, no consumer app. The
business brings its own customers via its booking link; we are infrastructure,
not a destination. Resisting feature creep toward "OpenTable but ours" is a
product decision, not an oversight.

## Commands

```bash
npm run dev         # Next dev server
npm test            # node:test via tsx, all *.test.ts under src/
npm run typecheck   # tsc --noEmit
npm run db:migrate  # prisma migrate dev
npm run db:seed     # reset + reseed the demo restaurant
npm run db:studio   # browse the database
npm run smoke       # end-to-end check against seeded data
```

## Stack, and the traps in it

- **Next.js 16 + React 19 + Tailwind 4.** See `AGENTS.md` above: this Next is
  newer than most training data. Read `node_modules/next/dist/docs/` before
  writing routes or server actions.
- **Prisma 7.10.0, pinned exactly. Do not run `npm update` on it.** The
  `latest` tag on the `prisma` package is an **8.0.0 release candidate** with a
  redesigned CLI, while `@prisma/client@latest` is 7.10.0 — installing the
  defaults gives you a mismatched pair that fails confusingly.
- **Prisma 7 needs a driver adapter**; there is no Rust engine in the SQL path.
  SQLite goes through `@prisma/adapter-better-sqlite3` (see `src/lib/db.ts`).
- **Config lives in `prisma7.config.ts`**, not `prisma.config.ts`.
- **npm 11 blocks native install scripts by default.** `better-sqlite3` will
  install without compiling and fail only at runtime. Fix with
  `npm install-scripts approve <pkg>` then `npm rebuild`.
- **SQLite, so no Prisma enums.** Status columns are `String`; allowed values
  live in `src/lib/constants.ts` as const objects with derived union types.
  This also makes the eventual Postgres move a connector change.

## Invariants — do not weaken these

These are the product, not implementation detail. `src/lib/booking/state-machine.ts`
enforces them and the tests pin them.

1. **A business cannot cause a charge by assertion.** Marking a no-show only
   moves the booking to `no_show_pending` and starts a clock. The system
   charges, never the business.
2. **A manual staff override may only ever prevent a charge, never create one.**
3. **Check-in is a customer action.** QR scan at the venue, or a
   location-validated link tap. It can pull a booking back out of the charge
   path at any point before the charge fires — the person who arrives at 20:25
   for a 20:00 booking must not be charged.
4. **The grace period is enforced, not advisory.** A booking cannot be marked
   absent until `gracePeriodMin` has fully elapsed. This turns the informal
   "we hold the table 15–20 minutes" into something a customer can rely on.
5. **`PolicySnapshot` is append-only.** It is the verbatim text the customer
   agreed to, with timestamp, IP and user agent. It is the evidence in a
   chargeback and is worthless if it can be edited afterwards.
6. **Money is integer minor units.** No float ever touches a currency value.
7. **`Charge.idempotencyKey` is unique at the DB level.** A retry or a
   double-click must not charge someone twice.
8. **Policy fails closed.** If no rule matches, require a card rather than
   silently dropping protection the business believes it has.

## Layout

```
prisma/schema.prisma          data model; generic over verticals
prisma/seed.ts                demo restaurant, anchored to service hours
src/lib/constants.ts          status unions (no enums on SQLite)
src/lib/db.ts                 Prisma client + adapter singleton
src/lib/booking/
  state-machine.ts            transitions + the invariants above
  availability.ts             pure slot generation, DST-safe
  policy.ts                   pure risk-based requirement resolution
  slots.ts                    DB-facing layer over both
scripts/smoke.ts              end-to-end sanity check
```

`availability.ts` and `policy.ts` are deliberately pure — they take loaded rows
and return results, so they test without a database. Keep them that way.

### Time handling

Where booking systems rot, so it is worth being explicit:

- Schedule rules store **local minutes from midnight**, not instants. 18:00
  stays 18:00 across a DST change; the UTC instant moves instead.
- `endMinute` may exceed 1440 for venues open past midnight (open until 01:00
  is `endMinute: 1500`).
- Every `Date` crossing a module boundary is a **true UTC instant**.
- `generateSlots` over-generates at the day edges and clips to the requested
  window — a `to` of `23:59:59Z` otherwise leaks the next local day in any zone
  east of UTC. This was a real bug; four tests pin it.

## Vertical generality

The model is deliberately not restaurant-specific:

| Concept   | Restaurant          | Detailing      | Clinic             |
|-----------|---------------------|----------------|--------------------|
| Resource  | table (capacity=N)  | bay (1)        | practitioner (1)   |
| Service   | 2h dinner seating   | 6h coating     | 45min appointment  |
| partySize | covers              | unused         | unused             |

`Service.usesPartySize` is the switch. Don't add restaurant-only columns.

## Status

Built: data model, migrations, state machine, availability engine, policy
engine, demo seed, smoke script. 33 tests passing.

Not built yet: payment provider interface (mock → Stripe), public booking page,
business dashboard, QR check-in, notifications, the scheduled job that fires
charges after the grace window.

Demo routes, once they exist: `/book/hanul-cu-tei`, `/dashboard/hanul-cu-tei`.
