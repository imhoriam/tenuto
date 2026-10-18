-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "accessToken" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN "city" TEXT;
ALTER TABLE "Location" ADD COLUMN "county" TEXT;
ALTER TABLE "Location" ADD COLUMN "postalCode" TEXT;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loginName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    CONSTRAINT "Account_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "rescueWindowMin" INTEGER NOT NULL DEFAULT 120,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Business" ("cancellationWindowHours", "createdAt", "currency", "email", "gracePeriodMin", "id", "name", "noShowFeeCents", "payoutsEnabled", "phone", "slug", "stripeAccountId", "subscriptionStatus", "timezone", "updatedAt", "vertical") SELECT "cancellationWindowHours", "createdAt", "currency", "email", "gracePeriodMin", "id", "name", "noShowFeeCents", "payoutsEnabled", "phone", "slug", "stripeAccountId", "subscriptionStatus", "timezone", "updatedAt", "vertical" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE INDEX "Business_slug_idx" ON "Business"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Account_loginName_key" ON "Account"("loginName");

-- CreateIndex
CREATE UNIQUE INDEX "Account_businessId_key" ON "Account"("businessId");

-- CreateIndex
CREATE INDEX "Session_accountId_idx" ON "Session"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_accessToken_key" ON "Booking"("accessToken");

