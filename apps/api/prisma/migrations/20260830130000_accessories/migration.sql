-- Accessories bought for a vehicle. Until now the only place to record one was a
-- MaintenanceRecord, which forces a service date and an odometer reading that a
-- purchase does not have, and which folds the spend into per-km running cost.

-- AlterEnum
ALTER TYPE "AuditResourceType" ADD VALUE 'accessory';

-- CreateTable
CREATE TABLE "Accessory" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "brand" VARCHAR(80),
    "category" VARCHAR(60),
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "fittedDate" TIMESTAMP(3),
    "fittedOdometer" INTEGER,
    "removedDate" TIMESTAMP(3),
    "removedOdometer" INTEGER,
    "warrantyExpiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accessory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Accessory_vehicleId_purchaseDate_idx" ON "Accessory"("vehicleId", "purchaseDate" DESC);

-- CreateIndex
CREATE INDEX "Accessory_vehicleId_removedDate_idx" ON "Accessory"("vehicleId", "removedDate");

-- CreateIndex
CREATE INDEX "Accessory_vehicleId_warrantyExpiresAt_idx" ON "Accessory"("vehicleId", "warrantyExpiresAt");

-- AddForeignKey
ALTER TABLE "Accessory" ADD CONSTRAINT "Accessory_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny-by-default RLS, matching 20260401120000_enable_public_schema_rls and its
-- follow-up: the app reaches Postgres through Prisma as the `postgres` role,
-- which bypasses RLS, so no policies are defined. Without this the table is
-- reachable through Supabase's PostgREST endpoint.
ALTER TABLE "Accessory" ENABLE ROW LEVEL SECURITY;
