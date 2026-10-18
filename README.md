# Tenuto

Reservations that are actually kept: a booking layer for restaurants that
charges a no-show fee only when someone doesn't turn up, and never touches
regulars.

The full product, invariants and architecture are in [CLAUDE.md](CLAUDE.md).

## Run it

```bash
npm install
npm run db:seed    # demo data in dev.db
npm run dev
```

- Booking page: http://localhost:3000/book/hanul-cu-tei
- Dashboard: http://localhost:3000/login — `hanul-cu-tei` / `tenuto-demo`
- `/admin` needs `TENUTO_ADMIN_PASSWORD` set (user `tenuto`)

## Check it

```bash
npm test                 # unit
npm run test:integration # money path against a throwaway database
npm run typecheck
npm run lint
```
