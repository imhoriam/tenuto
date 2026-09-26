-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "accessToken" TEXT;

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolution" TEXT,
    CONSTRAINT "Dispute_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Bucharest',
    "currency" TEXT NOT NULL DEFAULT 'RON',
    "email" TEXT,
    "phone" TEXT,
    "category" TEXT,
    "description" TEXT,
    "website" TEXT,
    "priceLevel" INTEGER,
    "legalName" TEXT,
    "taxId" TEXT,
    "vatPayer" BOOLEAN NOT NULL DEFAULT false,
    "tradeRegisterNo" TEXT,
    "registeredAddress" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "stripeAccountId" TEXT,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'trialing',
    "cancellationWindowHours" INTEGER NOT NULL DEFAULT 24,
    "noShowFeeCents" INTEGER NOT NULL DEFAULT 5000,
    "gracePeriodMin" INTEGER NOT NULL DEFAULT 15,
    "suspendedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Business" ("cancellationWindowHours", "category", "createdAt", "currency", "description", "email", "gracePeriodMin", "id", "legalName", "name", "noShowFeeCents", "payoutsEnabled", "phone", "priceLevel", "published", "registeredAddress", "slug", "stripeAccountId", "subscriptionStatus", "taxId", "timezone", "tradeRegisterNo", "updatedAt", "vatPayer", "vertical", "website") SELECT "cancellationWindowHours", "category", "createdAt", "currency", "description", "email", "gracePeriodMin", "id", "legalName", "name", "noShowFeeCents", "payoutsEnabled", "phone", "priceLevel", "published", "registeredAddress", "slug", "stripeAccountId", "subscriptionStatus", "taxId", "timezone", "tradeRegisterNo", "updatedAt", "vatPayer", "vertical", "website" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE INDEX "Business_slug_idx" ON "Business"("slug");
CREATE TABLE "new_Charge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerRef" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "nextRetryAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "succeededAt" DATETIME,
    "payoutStatus" TEXT NOT NULL DEFAULT 'held',
    "payoutReleaseAt" DATETIME,
    "refundedAt" DATETIME,
    "refundRef" TEXT,
    CONSTRAINT "Charge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Charge" ("amountCents", "attempt", "bookingId", "createdAt", "currency", "id", "idempotencyKey", "lastError", "nextRetryAt", "provider", "providerRef", "status", "succeededAt") SELECT "amountCents", "attempt", "bookingId", "createdAt", "currency", "id", "idempotencyKey", "lastError", "nextRetryAt", "provider", "providerRef", "status", "succeededAt" FROM "Charge";
DROP TABLE "Charge";
ALTER TABLE "new_Charge" RENAME TO "Charge";
CREATE UNIQUE INDEX "Charge_idempotencyKey_key" ON "Charge"("idempotencyKey");
CREATE INDEX "Charge_bookingId_idx" ON "Charge"("bookingId");
CREATE INDEX "Charge_status_nextRetryAt_idx" ON "Charge"("status", "nextRetryAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_bookingId_key" ON "Dispute"("bookingId");

-- CreateIndex
CREATE INDEX "Dispute_status_openedAt_idx" ON "Dispute"("status", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_accessToken_key" ON "Booking"("accessToken");

