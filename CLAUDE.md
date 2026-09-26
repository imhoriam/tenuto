@AGENTS.md

# Tenuto

**Reservations that are actually kept.**

The name is the musical instruction meaning *held*: a note sustained for its
full value. The table is held for exactly as long as the restaurant promised,
and the booking is honoured in full.

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
is unwritten, inconsistent, and understood differently by each side. Tenuto
makes it explicit: the restaurant sets it, the customer sees it before booking,
the code enforces it — and when it ends, the table goes back on sale.

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

The mirror-image objection comes from customers: *"what stops the restaurant
from just saying I never came?"* That one is answered too. See §3.6.

---

## 2. What Tenuto is

**Infrastructure a business installs, first; a place to find a table, second.**

The business embeds its booking link on its website, Instagram bio, Google
listing. Customers book through a mobile web page with no app and no account.
Most bookings never move money: the card is charged only when someone doesn't
turn up.

### Public search — a deliberate change (2026-09-26)

The original position was "not a marketplace: no discovery, no browsing". That
changed by product decision: there is now a public search page
(`/restaurants`) listing published restaurants by name, cuisine and city. It is
a directory, not a marketplace:

- **No reviews, ratings, rankings, promoted placements or loyalty scheme.**
- **No commission on bookings.** Revenue is still the subscription.
- The booking link each restaurant shares remains the primary channel.

If a future change adds ranking, reviews or pay-for-placement, it is drifting
toward OpenTable, and that is still the wrong direction.

### What Tenuto is *not*

- **Not a consumer app.** Nobody installs anything.
- **Not a general-purpose booking calendar.** The defensible wedge is the
  no-show and deposit layer done better than anyone else.
- **Not funded by no-shows.** Revenue is the business subscription. Taking a
  large cut of forfeited fees would create a company that profits when customers
  fail.

---

## 3. How it works — the customer's side

The design goal is that a good customer never notices Tenuto exists.

### 3.1 Finding it

A link from the restaurant (Instagram, Google, WhatsApp, its site), or the
public search page. It opens a mobile web page. No app, no account, no
password. **A phone number is the identity.**

### 3.2 Booking

Four steps, each revealed as the previous one is answered:

1. **How many people, and what day.** Day chips for the coming week.
2. **What time.** Only genuinely bookable slots — opening hours, table capacity,
   turnaround buffers, existing bookings and closures all accounted for.
3. **Who.** Name and phone number, optional note.
4. **Confirmation.** What happens next is decided *here* (§3.3).

### 3.3 The moment that matters

Once the phone number is known, the policy engine resolves what this person
must do for this booking — **before any card form is rendered.** A regular sees
"no card needed"; a first-timer sees "nothing is taken now, 50 RON if you don't
come"; someone with a prior no-show may be asked for more. The policy text is
shown in full, above the card field, must be explicitly accepted, and is stored
verbatim (§7.5).

### 3.4 After booking

- **Confirmation screen** — a ticket with the booking, plus the link to the
  customer's own booking page.
- **SMS** (`src/lib/notifications/`) — where, when, how long the table is held,
  and the link. No diacritics: one ă/ș/ț switches the message to UCS-2 and halves
  a segment. Kept to two segments.
- **Booking page** `/r/<accessToken>` — details, map link, the exact policy they
  accepted, the **arrival QR code**, and (if a fee is ever collected) the dispute
  button. The token is random, never derived from the id or reference. A
  customer who lost the link finds it at `/rezervare` with booking code + phone.

### 3.5 Arriving

The customer shows the QR on their booking page. **Staff scan it** with their
phone camera, which opens `/sosire/<token>` inside the restaurant's session,
and tap "Confirmă sosirea". Or the host asks "on what name?" and taps
"A sosit" on the dashboard.

**There is no customer self check-in.** An earlier version let the customer
confirm their own arrival (a personal link, then a door QR); it was removed by
product decision, because a link alone lets a no-show "arrive" from home. The
customer's protection is the dispute (§3.6), and the scan leaves a timestamped
record that serves as evidence in one.

The scan page never confirms on GET (link previews and prefetch would), refuses
other restaurants' bookings, and shows a customer who scans their own code a
"staff scan this" page with no button.

### 3.6 Not arriving — and the customer's guarantee

- **Grace is the only hold.** When the restaurant's grace period ends with no
  arrival recorded, the system marks the no-show, the **table is released for
  other guests**, and the fee becomes collectable. There is no further window.
  (A 2-hour "rescue window" existed and was removed: it made no sense to keep a
  fee uncollectable once the table had been given away.)
- Staff can still record a late arrival ("A venit totuși") or waive it until
  they run collection.
- **Collected money is held for `DISPUTE_WINDOW_DAYS` (7).** From their booking
  page the customer disputes with one tap. The money freezes: it does not reach
  the restaurant until the dispute is resolved.
- **The restaurant can refund. It cannot uphold.** Only Tenuto (the platform)
  can rule that a fee stands, from `/admin`, with the full audit trail in front
  of it. The ruling and its note appear on the customer's page.
- Restaurants with an abnormal dispute rate are flagged and can be suspended.

### 3.7 What the customer never experiences

Downloading anything · creating an account · paying to make a reservation ·
money leaving their account because they turned up · a charge they cannot
contest.

---

## 4. The idea that makes it sellable

**Risk-based enforcement.** Requirements are resolved per booking, per customer,
by rules the business controls. Rules are evaluated in ascending priority and
**the first match wins**.

| Priority | Rule | Condition | Requirement |
|---------:|------|-----------|-------------|
| 10 | Regulars book free | 3+ completed bookings here | **No card** |
| 20 | Previous no-show pays a deposit | any prior no-show | **Deposit**, 100 RON |
| 30 | Large parties leave a card | party of 6+ | **Card on file**, 150 RON |
| 100 | Everyone else leaves a card | — | **Card on file**, 50 RON |

- **Priority 10 beats 20.** Good history *here* outranks a black mark elsewhere.
- **Priority 20 beats 30.** The riskier signal wins.

These are the defaults every new restaurant gets on registration. The pitch:

> **"Protect yourself from the 10% who burn you, without touching your regulars."**

---

## 5. How it works — the business's side

### 5.1 Getting started

1. `/register` — restaurant name, username, password. Creates the business,
   a location, a default 2h table service and the default policy rules.
2. `/dashboard/<slug>/settings` — the profile, **field for field like a Google
   Business Profile** (category, description, phone, website, address, price
   range, opening hours with split shifts and past-midnight closes), the
   **company's legal data** (legal name, CUI with check-digit validation, trade
   register number, registered office, VAT payer), tables, and rules (grace
   period, fee, free-cancellation window, table duration, regulars rule).
3. **Publish** — only allowed once the profile can actually take a booking
   (`missingForPublish`). Any later save that makes it incomplete unpublishes it.
4. `/dashboard/<slug>/share` — booking link, a QR of it (PNG/SVG), an embed
   button snippet.

### 5.2 Running a service (`/dashboard/<slug>`)

Built for someone at a host stand with one hand free. Refreshes every 15s.

- **Search "on what name?"** — name, phone or code; accent-insensitive.
- **A sosit** — record an arrival. **A venit totuși** — the same, after the
  no-show was recorded. Both can only ever *prevent* a charge.
- **Iartă** — waive a fee not yet collected. **Rambursează** — refund one that
  was (including one under dispute). Both logged.
- **Încasează toate absențele** — collect every due fee of *this* restaurant.
- Money shown split: **paid out** vs **on hold** (inside the dispute window).
- Open disputes stay on the board, with the customer's own words, until settled.

### 5.3 What the business cannot do

- **Charge by assertion.** A no-show is recorded by the system at the end of
  grace; money moves only when collection runs.
- **Mark someone absent early.** The grace period is enforced in code.
- **Reverse an arrival.** Once recorded, settled.
- **Edit the policy snapshot.** What the customer agreed to is immutable.
- **Uphold a dispute.** Only the platform can.
- **Keep operating while suspended.** No bookings, no collection.

### 5.4 Commercial model

Subscription, tiered by size · small per-booking fee · the customer pays nothing
to book, ever.

---

## 6. Feature status

| Feature | State |
|---|---|
| Data model, migrations | **Built** |
| Booking state machine + invariants | **Built** |
| Availability engine (DST-safe, buffers, capacity) | **Built** |
| Risk-based policy engine | **Built** |
| Landing page, legal pages, public search | **Built** — legal texts are drafts (§14) |
| Restaurant accounts (register / login / sessions) | **Built** |
| Settings: GBP-style profile, fiscal data, hours, tables, rules, publish | **Built** |
| Public booking page + confirmation | **Built** |
| Customer booking page `/r/<token>` + lookup `/rezervare` | **Built** |
| Confirmation SMS | **Built** — console provider by default; Twilio adapter untested against a live account |
| Arrival by staff QR scan `/sosire/<token>` or by name | **Built** |
| Automatic no-show at end of grace; table released | **Built** — runs lazily (dashboard load, charge button) |
| Business dashboard, charge-all, waive / refund | **Built** |
| Payment provider boundary + mock (charge, refund) | **Built** |
| Payout hold, one-tap dispute, platform review `/admin`, suspension | **Built** |
| Charge collection with retry ladder (+24h, +72h) | **Built** |
| Stripe provider + Connect onboarding | **Not built** |
| Customer-side cancellation | **Not built** — customers are told to call |
| Reminder SMS (48h / 2h) | **Not built** — only the confirmation sends |
| Scheduled worker (sweep, collection, payout release) | **Not built** — all run lazily or from the button |
| Reliability counters (`completedCount`, `noShowCount`) | **Not maintained** — nothing increments them, so rules 10 and 20 only fire for seeded customers |
| Login rate limiting | **Not built** |

---

## 7. Invariants — do not weaken these

These are the product, not implementation detail. `src/lib/booking/state-machine.ts`
and `service.ts` enforce them; the unit and integration suites pin them.

1. **A business cannot cause a charge by assertion.** The no-show is recorded by
   the system when grace ends (`sweepNoShows`, actor `system`), or by staff only
   after grace. Recording it moves no money; collection does.
2. **A manual staff override may only ever prevent a charge, never create one.**
3. **An arrival can be recorded at any point before the charge fires** — staff
   scan or name lookup — and it clears the charge permanently.
4. **The grace period is enforced, not advisory**, and it is the *only* hold. The
   grace in the booking's `PolicySnapshot` wins over the business's current
   setting: shortening grace later must not shorten it for existing bookings.
5. **`PolicySnapshot` is append-only.** Verbatim text, timestamp, IP, user agent.
6. **Money is integer minor units.** No float ever touches a currency value.
7. **`Charge.idempotencyKey` is unique at the database level**, and refunds use
   a per-charge idempotency key. A retry must not charge or refund twice.
8. **Policy fails closed.** If no rule matches, require a card.
9. **A requirement of `none` can never carry a fee.**
10. **Collected money is held, and a dispute freezes it.** Only the customer can
    open a dispute; the business may refund; only the platform may uphold
    (`assertActorMayResolveDispute`). Frozen money is never released by time.
11. **Waiving a collected fee refunds it** through the provider — never just a
    status change.
12. **A suspended business takes no bookings and collects nothing.**

---

## 8. How the money actually moves

Deliberately *not* an authorisation hold — those expire in about a week.

```
Booking made   →  card saved (SetupIntent, 3DS, MIT-flagged). No money moves.
Arrival        →  staff scan / name. Nothing ever happens. (~85–90% end here.)
Grace ends     →  system records the no-show; table released; fee collectable.
Collection     →  off-session PaymentIntent. Money HELD for 7 days.
  7 days pass  →  payout RELEASED to the restaurant.
  or dispute   →  FROZEN → restaurant refunds, or platform refunds / upholds.
```

Payout states (`PAYOUT_STATUS`): `held` → `released`, or `held` → `frozen` →
`released` | `refunded`. Soft declines retry at +24h and +72h, then stop; hard
declines never retry.

With Stripe this means separate charges and transfers (transfer on release),
not destination charges that pay out immediately.

---

## 9. Commands

```bash
npm run dev              # Next dev server
npm test                 # unit tests (node:test via tsx)
npm run test:integration # full money path against a throwaway database
npm run typecheck        # next typegen && tsc --noEmit
npm run lint
npm run build

npm run db:migrate       # prisma migrate dev — interactive only, see §10
npm run db:seed          # reset + reseed the demo data
npm run db:studio
npm run smoke            # sanity check against seeded data
npm run money            # the money path, narrated; pass a test card to vary it
```

Demo: `/book/hanul-cu-tei`; dashboard login `hanul-cu-tei` / `tenuto-demo`. The
seed prints a disputable customer link and the admin URL.

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file |
| `TENUTO_PUBLIC_URL` | Base for links that leave the browser (SMS, QR). Set in production, or SMS links point at whatever host served the request. |
| `TENUTO_ADMIN_PASSWORD` | Enables `/admin` (HTTP Basic, user `tenuto`). Unset → `/admin` is a 404. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID` | Real SMS. Unset → messages go to the server log. |

---

## 10. Stack, and the traps in it

- **Next.js 16 + React 19 + Tailwind 4.** See `AGENTS.md`. `params` and
  `searchParams` are Promises. Middleware is now **`src/proxy.ts`** (it guards
  `/admin`). `PageProps<"/route">` / `LayoutProps` are generated by typegen.
- **Stale `.next/dev/types/validator.ts`.** After deleting a route while
  `next dev` runs, this generated file still imports it and breaks
  `typecheck`/`build`. Delete it; the dev server rewrites it.
- **Prisma 7.10.0, pinned exactly. Do not run `npm update` on it.** `prisma@latest`
  is an 8.0.0 RC; `@prisma/client@latest` is 7.10.0.
- **`prisma migrate dev` refuses non-interactive shells** (agents, CI). Generate
  SQL with `prisma migrate diff --from-config-datasource --to-schema
  prisma/schema.prisma --script` into a new `prisma/migrations/<ts>_<name>/`,
  then `prisma migrate deploy` and `prisma generate`.
- **A running dev server keeps an old Prisma client** after `generate`.
  `src/lib/db.ts` detects this (`instanceof`) and rebuilds; restart if in doubt.
- **Prisma 7 requires a driver adapter**; SQLite via `@prisma/adapter-better-sqlite3`.
- **Config lives in `prisma7.config.ts`**, not `prisma.config.ts`.
- **npm 11 blocks native install scripts.** `allowScripts` in `package.json` fixes
  `better-sqlite3`; it is committed and CI depends on it.
- **SQLite, so no Prisma enums.** Allowed values live in `src/lib/constants.ts`.
- **SQLite `LIKE` is ASCII-only.** Search folds diacritics in memory
  (`fold()`); fine while the list is small, move to Postgres unaccent later.
- **`revalidatePath` throws outside a request.** Keep it out of code the
  integration suite calls directly (server actions it imports).
- **`npm audit` advisories from the `prisma` CLI** — leave them; `--force`
  installs the RC.
- **zsh:** never name a shell variable `path` — it overwrites `$PATH`.

### Auth

- Restaurant sessions: random token in an httpOnly cookie, SHA-256 in `Session`
  (`src/lib/auth/session.ts`). Passwords: scrypt from `node:crypto`.
- Authorisation happens next to the data: every dashboard page calls
  `requireBusiness(slug)`, every dashboard action `authorizeBusiness(slug)` and
  checks the booking belongs to that business. Layouts are not a security
  boundary.
- `/admin` is separate from restaurant accounts on purpose: a restaurant login
  must never be able to rule on its own disputes.

---

## 11. Layout

```
prisma/schema.prisma            data model; generic over verticals
prisma/seed.ts                  demo restaurant + three neighbours, staged around now
src/proxy.ts                    Basic-auth gate for /admin
src/lib/constants.ts            status unions, PAYOUT_STATUS, DISPUTE_*, ACTOR
src/lib/db.ts                   Prisma client + adapter singleton
src/lib/format.ts               money/time formatting, business timezone
src/lib/origin.ts               request origin; publicBaseUrl() for SMS/QR links
src/lib/business-profile.ts     pure: categories, CUI check digit, hours ⇄ rules, readiness
src/lib/auth/                   password (scrypt), session, admin
src/lib/notifications/          messages (pure SMS text), sms (providers), deliver
src/lib/payments/               provider boundary (charge, refund) + mock
src/lib/booking/
  state-machine.ts              transitions + actor rules (§7)
  availability.ts               pure slot generation, DST-safe
  policy.ts                     pure risk-based requirement resolution
  slots.ts                      DB-facing layer over both
  service.ts                    createBooking, checkIn, sweepNoShows, collectDueCharges,
                                refundBooking, openDispute, resolveDispute,
                                releaseDuePayouts, setSuspended
src/app/                        (Romanian UI throughout)
  page.tsx                      landing
  restaurants/                  public search
  legal/                        terms, no-show policy, privacy, cookies
  register/ login/ auth-actions registration and login
  book/[slug]/                  public booking flow
  r/[token]/                    customer booking page: QR, details, dispute
  rezervare/                    find a booking by code + phone
  sosire/[token]/               what staff open when they scan the QR
  dashboard/[slug]/             service board, settings/, share/
  admin/                        disputes and suspensions (platform)
src/components/                 logo, header, footer, ui class strings, covers
scripts/smoke.ts                sanity check against seeded data
scripts/integration.mts         full money path against a real database
scripts/money-path.mts          narrated walk-through of one booking
```

`availability.ts`, `policy.ts`, `business-profile.ts` and
`notifications/messages.ts` are deliberately **pure**. Keep them that way.

### Time handling

- Schedule rules store **local minutes from midnight**; `endMinute` may exceed
  1440 for venues open past midnight (01:00 is `1500`).
- Every `Date` crossing a module boundary is a **true UTC instant**.
- `generateSlots` over-generates at day edges and clips — four tests pin it.

### Concurrency

`createBooking` re-checks overlap **inside** the transaction; sufficient on
SQLite. **On Postgres replace it** with an exclusion constraint over
`(resourceId, tstzrange(startAt, endAt))` or a per-resource advisory lock.
`sweepNoShows` uses a conditional `updateMany` so a concurrent arrival wins.

---

## 12. Vertical generality

| Concept | Restaurant | Detailing | Clinic | Studio |
|---|---|---|---|---|
| `Resource` | table (capacity = seats) | bay (1) | practitioner (1) | chair (1) |
| `Service` | 2h dinner seating | 6h ceramic coating | 45min appointment | 3h session |
| `partySize` | covers | unused | unused | unused |

`Service.usesPartySize` is the switch. **Do not add restaurant-only columns.**
The UI, settings and copy are restaurant-specific today; the model is not.

---

## 13. Design — risograph

The frontend is a two-ink risograph print (from the `riso` skill in
`.agents/skills/riso`):

- **Tokens** in `src/app/globals.css`: paper `#f4eee1`, federal blue `#2c40a7`
  (headings, rules, the offset print-shadow), fluorescent pink `#f237a1` — the
  **only interaction colour**. Overlaps multiply to violet.
- **Type:** Space Grotesk; Overpass Mono for labels.
- **Effects:** `.overprint` (a word in both inks, off-register), `.press`
  (buttons that press into their shadow), halftone screens, `.perforated`
  tickets, `.stamp`, the marquee. All disabled under `prefers-reduced-motion`.
- **Logo** (`src/components/logo.tsx`, `src/app/icon.svg`): a note head under
  a tenuto bar, printed in two slightly misregistered plates.
- **Contrast rules:** pink is never a text colour on paper (2.8:1); text on pink
  is ink. Small pink text uses `pink-deep` `#b0156d` (5.7:1).
- Class strings live in `src/components/ui.ts` (`btn`, `field`, `label`).

Grid children that contain horizontally scrolling rows need `min-w-0`, or the
page overflows on phones — this bit four pages.

---

## 14. Testing

- **Unit** (`npm test`) — state machine, availability, policy, profile helpers,
  password hashing, SMS text.
- **Integration** (`npm run test:integration`) — throwaway SQLite per run. Covers
  grace enforcement, automatic no-show and table release, idempotent collection,
  the retry ladder actually climbing, arrivals clearing charges, hard vs soft
  declines, regulars with no card, per-restaurant charging, payout hold and
  release, disputes (open, freeze, refund, uphold, window, who may do what),
  refunds on waive, suspension, confirmation SMS success and failure, and an
  audit-trail check.

When changing anything in §7, the integration suite is the one that matters.

### Before launch

- `src/lib/legal.ts` holds placeholder operator details (CUI, address) that
  render in the footer and legal pages. The legal texts under `src/app/legal/`
  describe the product's real behaviour but are drafts for a lawyer to review.
