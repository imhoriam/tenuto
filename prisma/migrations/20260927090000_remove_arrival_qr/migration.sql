-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "locationId" TEXT,
    "customerId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "requirement" TEXT NOT NULL DEFAULT 'none',
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "chargeableAt" DATETIME,
    "confirmedAt" DATETIME,
    "cancelledAt" DATETIME,
    "checkedInAt" DATETIME,
    "noShowMarkedAt" DATETIME,
    "completedAt" DATETIME,
    "customerNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("businessId", "cancelledAt", "chargeableAt", "checkedInAt", "completedAt", "confirmedAt", "createdAt", "customerId", "customerNote", "endAt", "feeCents", "id", "locationId", "noShowMarkedAt", "partySize", "reference", "requirement", "resourceId", "serviceId", "startAt", "status", "updatedAt") SELECT "businessId", "cancelledAt", "chargeableAt", "checkedInAt", "completedAt", "confirmedAt", "createdAt", "customerId", "customerNote", "endAt", "feeCents", "id", "locationId", "noShowMarkedAt", "partySize", "reference", "requirement", "resourceId", "serviceId", "startAt", "status", "updatedAt" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");
CREATE INDEX "Booking_businessId_startAt_idx" ON "Booking"("businessId", "startAt");
CREATE INDEX "Booking_resourceId_startAt_endAt_idx" ON "Booking"("resourceId", "startAt", "endAt");
CREATE INDEX "Booking_status_chargeableAt_idx" ON "Booking"("status", "chargeableAt");
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");
CREATE TABLE "new_CheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorLabel" TEXT,
    CONSTRAINT "CheckIn_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CheckIn" ("actorLabel", "at", "bookingId", "id", "method") SELECT "actorLabel", "at", "bookingId", "id", "method" FROM "CheckIn";
DROP TABLE "CheckIn";
ALTER TABLE "new_CheckIn" RENAME TO "CheckIn";
CREATE INDEX "CheckIn_bookingId_idx" ON "CheckIn"("bookingId");
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "county" TEXT,
    "postalCode" TEXT,
    "lat" REAL,
    "lng" REAL,
    CONSTRAINT "Location_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Location" ("address", "businessId", "city", "county", "id", "lat", "lng", "name", "postalCode") SELECT "address", "businessId", "city", "county", "id", "lat", "lng", "name", "postalCode" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE INDEX "Location_businessId_idx" ON "Location"("businessId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

