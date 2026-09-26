import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 runs through a driver adapter — there is no Rust engine in the SQL
 * path. Swapping SQLite for Postgres later means changing this adapter and the
 * datasource provider, not the queries.
 */
const createClient = () => {
  const url = process.env.DATABASE_URL;

  // Fail loudly rather than guessing a path. better-sqlite3 happily *creates*
  // a database at whatever path it is given, so a wrong default does not
  // error — it silently hands back an empty database and every query returns
  // nothing. A crash here is far cheaper to debug.
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Next loads .env automatically; standalone " +
        'scripts must `import "dotenv/config"` or set it explicitly.',
    );
  }

  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
};

// Next dev server hot-reloads modules; without this we leak a connection per
// reload until SQLite starts refusing them.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

// After `prisma generate` the dev server hot-reloads a *new* PrismaClient class,
// but the cached instance is still the old one — it lacks any model added since
// (e.g. `db.account` is undefined). instanceof against the fresh class catches
// that and rebuilds, at the cost of one leaked connection per regeneration.
const cached = globalForPrisma.prisma;
export const db = cached instanceof PrismaClient ? cached : createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
