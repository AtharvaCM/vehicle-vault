-- What was known about a vehicle's servicing when it entered the vault.
--
-- The alert engine previously measured every service interval from the odometer
-- at the moment a vehicle was added whenever no MaintenanceRecord existed for a
-- category. On a used vehicle that silently asserts everything had just been
-- done: a bike added at 40 000 km was treated as having had its brake pads
-- changed at 40 000 km, so nothing was due until 70 000.
--
-- A row here replaces that assumption with either a real figure or an explicit
-- "nobody knows". The absence of a row stays meaningful as a third state — not
-- asked yet — so existing vehicles keep the old behaviour instead of being
-- retroactively declared unknown and alerted about.

-- AlterEnum
ALTER TYPE "AuditResourceType" ADD VALUE 'service_baseline';

-- CreateEnum
CREATE TYPE "ServiceBaselineStatus" AS ENUM ('known', 'unknown');

-- CreateTable
CREATE TABLE "ServiceBaseline" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "status" "ServiceBaselineStatus" NOT NULL,
    "lastDoneOdometer" INTEGER,
    "lastDoneDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceBaseline_vehicleId_category_key" ON "ServiceBaseline"("vehicleId", "category");

-- CreateIndex
CREATE INDEX "ServiceBaseline_vehicleId_idx" ON "ServiceBaseline"("vehicleId");

-- AddForeignKey
ALTER TABLE "ServiceBaseline" ADD CONSTRAINT "ServiceBaseline_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A `known` baseline that carries neither a reading nor a date knows nothing,
-- and an `unknown` one carrying either is contradicting itself. Both would reach
-- the alert engine as a status it is entitled to trust, so the database refuses
-- them rather than leaving the engine to re-check what the status already says.
ALTER TABLE "ServiceBaseline" ADD CONSTRAINT "service_baseline_status_matches_figures" CHECK (
    ("status" = 'known' AND ("lastDoneOdometer" IS NOT NULL OR "lastDoneDate" IS NOT NULL))
    OR
    ("status" = 'unknown' AND "lastDoneOdometer" IS NULL AND "lastDoneDate" IS NULL)
);

-- Deny-by-default RLS, matching 20260401120000_enable_public_schema_rls: the app
-- reaches Postgres through Prisma as the `postgres` role, which bypasses RLS, so
-- no policies are defined. Without this the table is reachable through
-- Supabase's PostgREST endpoint.
ALTER TABLE "ServiceBaseline" ENABLE ROW LEVEL SECURITY;
