@AGENTS.md

# Tenuto

**Reservations that are actually kept.**

The name is the musical instruction meaning *held*: a note sustained for its
full value. The reservation is held, the deposit is held, and the booking is
honoured in full.

---

## 1. The problem

A no-show is not a neutral event. It is a table, a chair, a bay or an hour of a
practitioner's time that was **deliberately withheld from paying customers** and
then wasted.

The damage compounds in a way operators feel but rarely quantify:

1. **The direct loss.** The covers, the service, the margin. For a restaurant on
   a Tuesday that might be recoverable. For a six-hour ceramic coating, a
   90-minute dental slot or a full-day tattoo session, it is gone.
2. **The turned-away customer.** Walk-ins arrive, see "reserved" cards on empty
   tables, and leave. The business loses the no-show *and* the person who would
   have filled the gap.
3. **The staffing cost.** Rotas are set against the book. A 20% no-show rate
   means paying for a Friday night that never materialised.
4. **The waiting list that was told no.** The most expensive loss, and the one
   nobody measures.

There is a second, quieter problem specific to restaurants: **the informal grace
period.** Most venues hold a table 15–20 minutes past the reservation time. This
is unwritten, inconsistent, and understood differently by each side. The
customer thinks they have "a bit of leeway"; the host is watching a full room
and a dead table. Nobody has agreed on anything, so both sides feel wronged.

### Why this isn't already solved

The mechanism — take a card, charge on a no-show — has existed for a decade.
OpenTable and Resy support card holds; Tock was built on prepaid reservations.

The mechanism was never the hard part. **Adoption is.** Operators do not impose
deposits because they are afraid of friction:

> *"I don't want to scare my regulars away."*

That objection is correct, and it kills the blunt version of this product. A
system that demands a card from everyone trades a 12% no-show rate for a 20%
booking-abandonment rate, and the operator is worse off.

**Tenuto's entire thesis is that the objection is answerable.** Not by arguing
with it — by building a system where it doesn't apply. See §4.

---

## 2. What Tenuto is

**Infrastructure a business installs, not a destination customers visit.**

The business embeds a booking link on its website, its Instagram bio, its Google
listing. Customers book through a mobile web page with no app and no account.
Most bookings never move money: the card is charged only when someone doesn't
turn up.

### What Tenuto is *not* — and this is a product decision, not an omission

- **Not a marketplace.** No discovery, no browsing, no "restaurants near me", no
  reviews, no loyalty scheme. The business brings its own customers.
- **Not a consumer app.** Nobody installs anything. Asking a diner to download an
  app to book a table is asking them to do something they will not do.
- **Not a general-purpose booking calendar.** That category is crowded and
  low-margin. The defensible wedge is the no-show and deposit layer done better
  than anyone else. Drifting toward a generic calendar loses the only advantage
  there is.
- **Not funded by no-shows.** Revenue is the business subscription. Taking a
  large cut of forfeited fees would create a company that profits when customers
  fail, which is not a business worth explaining to anyone.

If a future change makes Tenuto more like OpenTable, it is the wrong change.

---

## 3. How it works — the customer's side

The design goal is that a good customer never notices Tenuto exists.

### 3.1 Finding it

The customer taps a link — Instagram bio, the venue's site, a Google listing, a
WhatsApp reply. It opens a mobile web page. There is no app to install, no
account to create, no password. **A phone number is the identity.**

### 3.2 Booking

Four steps, in order, each revealed as the previous one is answered:

1. **How many people, and what day.** Party size drives which tables can be
   offered at all.
2. **What time.** Only genuinely bookable slots are shown — availability accounts
   for opening hours, table capacity, turnaround buffers, existing bookings and
   closures. A slot that appears is a slot that exists.
3. **Who.** Name and phone number. An optional note ("table by the window").
4. **Confirmation.** What happens next is decided *here*, and depends entirely on
   who they are.

### 3.3 The moment that matters

Once the phone number is known, the policy engine resolves what this specific
person must do for this specific booking — **before any card form is rendered.**

- **A known regular** sees: *"You're a regular — no card needed. Your table is
  held for 15 minutes past your booking time."* They tap confirm. Done. They
  never learn that a payment system was involved.
- **A first-time customer** sees: *"Nothing is taken now. If you don't arrive, or
  cancel less than 24 hours before, you'll be charged 50 RON. Your table is held
  for 15 minutes past your booking time."* They enter a card. **No money moves.**
- **Someone with a prior no-show** may be asked for an actual deposit rather than
  a card on file.

The policy text is shown in full, in plain language, *above* the card field, and
must be explicitly accepted. The exact wording shown is stored verbatim with the
booking (see §7.5).

### 3.4 Before the booking

Confirmation immediately. Reminders at 48 hours and 2 hours before, each
carrying the booking details, a one-tap cancel link, and the check-in link.

Cancelling inside the policy window costs nothing — and the cancel link is
deliberately prominent. **A cancellation is a win**: the table gets re-sold. The
system should make cancelling easier than ghosting, because ghosting is the
expensive outcome.

### 3.5 Arriving

The customer scans a QR code at the entrance, or taps the check-in link in their
reminder. That single action clears the hold permanently.

**Check-in is a customer action by design.** It is the only thing that can pull a
booking out of the charge path, and it works right up until the charge fires — so
someone who arrives at 20:25 for a 20:00 booking is never charged, even if the
host already marked them absent.

### 3.6 Not arriving

The grace period runs. Once it fully elapses, the host can mark them absent —
which starts a clock, not a charge. After a further window (default 2 hours, so
honest mistakes can be reversed), the card is charged.

The customer is notified with the amount, the booking it relates to, and a
one-tap route to dispute it.

### 3.7 What the customer never experiences

- Downloading anything
- Creating an account or a password
- Paying to make a reservation
- Money leaving their account because they turned up
- Waiting for a refund

---

## 4. The idea that makes it sellable

**Risk-based enforcement.** Requirements are resolved per booking, per customer,
by rules the business controls. Rules are evaluated in ascending priority and
**the first match wins**.

The seeded restaurant demonstrates the shape:

| Priority | Rule | Condition | Requirement |
|---------:|------|-----------|-------------|
| 10 | Regulars book free | 3+ completed bookings here | **No card** |
| 20 | Previous no-show pays a deposit | any prior no-show | **Deposit**, 100 RON |
| 30 | Large parties leave a card | party of 6+ | **Card on file**, 150 RON |
| 100 | Everyone else leaves a card | — | **Card on file**, 50 RON |

Two orderings in that table are the whole product:

- **Priority 10 beats 20.** A customer who no-showed elsewhere but has a good
  history *here* books with no card. This business's own experience outranks a
  black mark somewhere else.
- **Priority 20 beats 30.** A repeat no-show booking a six-top pays the deposit,
  not the card-on-file — the riskier signal wins.

This changes the pitch entirely. It is no longer *"make your customers pay a
deposit."* It is:

> **"Protect yourself from the 10% who burn you, without touching your regulars."**

That is a sentence operators say yes to.

**Reminders are the other half.** Automated reminders reduce no-shows on their
own, cost almost nothing, and meet zero customer resistance. Deposits are the
escalation for when reminders fail. Leading with reminders also gets Tenuto in
front of businesses not yet ready for deposits — and once they are on the
system, enabling deposits is one switch.

---

## 5. How it works — the business's side

### 5.1 Getting started

Sign up, describe the space (tables and their capacities, opening hours,
services and durations), connect a payout account, and get a booking link plus an
embeddable widget. The default policy rules are sensible out of the box; most
operators will never tune them, which is why the defaults are a product opinion
rather than a blank form.

### 5.2 Running a service

The dashboard is built for someone standing at a host stand with one hand free.

- **Tonight's book** — every booking in a rolling window, ordered by time, with
  table, party size, customer, and whether they are protected by a card.
- **"A sosit" (Arrived)** — one tap to seat someone. Always available, and it can
  only ever *prevent* a charge.
- **"Absent"** — disabled, with the reason shown, until the grace period fully
  elapses (*"Grace period still running — 9 min left"*). Once enabled, tapping it
  starts the charge clock.
- **"A venit totuși" (Came anyway)** — the rescue. Pulls someone back out of the
  charge path after being marked absent.
- **"Iartă" (Waive)** — forgive the fee entirely. Always available, always logged.
- **Money recovered** — total collected and how many no-shows it came from. This
  is the number that justifies the invoice.

### 5.3 What the business cannot do

Deliberate constraints, because the trust model depends on them:

- **Cannot charge someone by assertion.** Marking a no-show starts a clock; the
  system charges, after the window, and only if the customer never checked in.
- **Cannot reverse a check-in.** Once someone is recorded as present, that is
  settled.
- **Cannot mark someone absent early.** The grace period is enforced in code.
- **Cannot edit the policy snapshot.** What the customer agreed to is immutable.

A business that could quietly mark honest customers absent would be a business
that makes Tenuto unusable for everyone. Platform-wide no-show rates are tracked
per business so outliers can be reviewed.

### 5.4 Commercial model

- **Subscription**, tiered by size — the predictable revenue.
- **Small per-booking fee** — scales with value delivered.
- **Customer pays nothing to book.** Ever.

---

## 6. Feature status

| Feature | State |
|---|---|
| Data model, migrations | **Built** |
| Booking state machine + invariants | **Built** |
| Availability engine (DST-safe, buffers, capacity) | **Built** |
| Risk-based policy engine | **Built** |
| Public booking page | **Built** |
| Business dashboard | **Built** |
| Payment provider boundary + mock | **Built** |
| Charge collection job with retry ladder | **Built** |
| Demo seed + smoke script | **Built** |
| QR check-in (customer-side) | **Not built** — the real gap |
| Notification delivery (SMS/WhatsApp) | **Not built** — rows written, nothing sends |
| Stripe provider + Connect onboarding | **Not built** |
| Customer-side cancellation | **Not built** |
| Scheduled worker (job exists; runs from a button) | **Not built** |

**QR check-in is the most important missing piece.** Without it only staff can
check someone in, which is the weaker half of the trust model.

---

## 7. Invariants — do not weaken these

These are the product, not implementation detail. `src/lib/booking/state-machine.ts`
enforces them; the unit and integration suites pin them.

1. **A business cannot cause a charge by assertion.** Marking a no-show moves the
   booking to `no_show_pending` and starts a clock. The system charges.
2. **A manual staff override may only ever prevent a charge, never create one.**
3. **Check-in is a customer action** and can pull a booking out of the charge
   path at any point before the charge fires.
4. **The grace period is enforced, not advisory.** No booking can be marked
   absent until `gracePeriodMin` has fully elapsed.
5. **`PolicySnapshot` is append-only.** Verbatim text, timestamp, IP, user agent.
   It is the evidence in a chargeback and is worthless if editable afterwards.
6. **Money is integer minor units.** No float ever touches a currency value.
7. **`Charge.idempotencyKey` is unique at the database level.** A retry or a
   double-click must not charge twice.
8. **Policy fails closed.** If no rule matches, require a card rather than
   silently dropping protection the business believes it has.
9. **A requirement of `none` can never carry a fee.**

---

## 8. How the money actually moves

Deliberately *not* an authorisation hold. Card authorisations expire in roughly a
week, which is useless for a booking made a month out.

Instead: **save the card, charge only on a no-show.**

```
Booking made   →  SetupIntent, 3DS, flagged for merchant-initiated transactions
                  No money moves. No processing fee. Nothing to refund.

Customer shows →  Check-in clears the mandate. Nothing ever happens.
                  (~85-90% of bookings end here.)

No-show        →  Grace period elapses → host marks absent → 2h window →
                  off-session PaymentIntent for the fee.
```

Failure handling is a first-class path, not an afterthought. Soft declines
(insufficient funds) retry at +24h then +72h, then stop. Hard declines (card
declined, expired) are not retried at all. Chasing a 50 RON fee for a fortnight
costs more in support than it collects.

The alternative — capturing a real deposit up front and crediting it against the
bill — reduces no-shows further but adds friction and processing cost on every
booking. It is available per-service for high-ticket work, not the default.

---

## 9. Commands

```bash
npm run dev              # Next dev server
npm test                 # unit tests (node:test via tsx)
npm run test:integration # full money path against a throwaway database
npm run typecheck        # next typegen && tsc --noEmit
npm run lint
npm run build

npm run db:migrate       # prisma migrate dev
npm run db:seed          # reset + reseed the demo restaurant
npm run db:studio        # browse the database
npm run smoke            # end-to-end check against seeded data
```

Demo routes: `/book/hanul-cu-tei`, `/dashboard/hanul-cu-tei`.

---

## 10. Stack, and the traps in it

- **Next.js 16 + React 19 + Tailwind 4.** See `AGENTS.md`: this Next is newer
  than most training data. Read `node_modules/next/dist/docs/` before writing
  routes or server actions. `params` is a **Promise** and must be awaited.
- **Prisma 7.10.0, pinned exactly. Do not run `npm update` on it.** The `latest`
  tag on the `prisma` package is an **8.0.0 release candidate** with a redesigned
  CLI, while `@prisma/client@latest` is 7.10.0. Installing the defaults gives a
  mismatched pair that fails confusingly.
- **Prisma 7 requires a driver adapter**; there is no Rust engine in the SQL
  path. SQLite goes through `@prisma/adapter-better-sqlite3` (`src/lib/db.ts`).
- **Config lives in `prisma7.config.ts`**, not `prisma.config.ts`.
- **npm 11 blocks native install scripts by default.** `better-sqlite3` installs
  without compiling and fails only at runtime. The `allowScripts` map in
  `package.json` is what fixes this — it is committed, and CI depends on it.
- **SQLite, so no Prisma enums.** Status columns are `String`; allowed values
  live in `src/lib/constants.ts` as const objects with derived union types. This
  also makes the eventual Postgres move a connector change.
- **`npm audit` reports advisories from the `prisma` CLI** (`mysql2`,
  `deepmerge-ts`). Neither ships in the app bundle, and `npm audit fix --force`
  "fixes" them by installing the 8.0.0 RC. Leave them. Revisit when Prisma 8 is
  stable.

---

## 11. Layout

```
prisma/schema.prisma          data model; generic over verticals
prisma/seed.ts                demo restaurant, anchored to service hours
src/lib/constants.ts          status unions (no enums on SQLite)
src/lib/db.ts                 Prisma client + adapter singleton
src/lib/format.ts             money/time formatting, business timezone
src/lib/payments/
  provider.ts                 the boundary; Stripe slots in behind this
  mock.ts                     demo provider, Stripe test-card semantics
src/lib/booking/
  state-machine.ts            transitions + the invariants in §7
  availability.ts             pure slot generation, DST-safe
  policy.ts                   pure risk-based requirement resolution
  slots.ts                    DB-facing layer over both
  service.ts                  createBooking, checkIn, markNoShow, collect
src/app/book/[slug]/          public booking flow
src/app/dashboard/[slug]/     business dashboard
scripts/smoke.ts              end-to-end sanity check
scripts/integration.mts       full money path against a real database
```

`availability.ts` and `policy.ts` are deliberately **pure** — they take loaded
rows and return results, so they test without a database. Keep them that way.

### Time handling

Where booking systems rot, so it is worth being explicit:

- Schedule rules store **local minutes from midnight**, not instants. 18:00 stays
  18:00 across a DST change; the UTC instant moves instead.
- `endMinute` may exceed 1440 for venues open past midnight (open until 01:00 is
  `endMinute: 1500`).
- Every `Date` crossing a module boundary is a **true UTC instant**.
- `generateSlots` over-generates at day edges and clips to the requested window —
  a `to` of `23:59:59Z` otherwise leaks the next local day in any zone east of
  UTC. This was a real bug; four tests pin it.

### Concurrency

`createBooking` re-checks overlap **inside** the transaction. That is sufficient
on SQLite, which serialises writes. **On Postgres this must be replaced** with an
exclusion constraint over `(resourceId, tstzrange(startAt, endAt))` or a
transaction-scoped advisory lock per resource — a plain re-check races there.

---

## 12. Vertical generality

The model is deliberately not restaurant-specific. A restaurant is the demo, not
the ceiling.

| Concept | Restaurant | Detailing | Clinic | Studio |
|---|---|---|---|---|
| `Resource` | table (capacity = seats) | bay (1) | practitioner (1) | chair (1) |
| `Service` | 2h dinner seating | 6h ceramic coating | 45min appointment | 3h session |
| `partySize` | covers | unused | unused | unused |
| Typical fee | 50 RON | 150 RON | 100 RON | 200 RON |

`Service.usesPartySize` is the switch. **Do not add restaurant-only columns.**

Worth noting: restaurants are the *hardest* vertical commercially — lowest value
per no-show, most competition, most price sensitivity. High-value appointment
businesses (detailing, clinics, tattoo studios) have 3–5x the pain per no-show
and almost no competition. The architecture stays neutral so that pivot remains
cheap.

---

## 13. Testing

- **Unit** (`npm test`) — state machine, availability, policy. Pure, fast, no DB.
- **Integration** (`npm run test:integration`) — creates a throwaway SQLite
  database per run, migrates it, and drives the real money path: grace
  enforcement, charge scheduling, idempotent collection, the late-arrival rescue,
  hard vs soft declines, regulars booking with no card, and an audit-trail check.

When changing anything in §7, the integration suite is the one that matters.
It has already caught a bug the unit tests could not: a mock provider whose
declines never fired because the payment method reference did not carry the
card's last four digits, so every simulated decline silently succeeded.
