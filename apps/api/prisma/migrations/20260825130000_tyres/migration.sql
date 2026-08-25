-- Per-tyre tracking. Until now tyre health was inferred purely from the dates of
-- service events, which cannot see the two facts that actually decide whether a
-- tyre is safe: how much tread is left, and how old the rubber is.

-- CreateEnum
CREATE TYPE "TyrePosition" AS ENUM ('front_left', 'front_right', 'rear_left', 'rear_right', 'spare');

-- CreateTable
CREATE TABLE "Tyre" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "position" "TyrePosition" NOT NULL,
    "brand" VARCHAR(80),
    "model" VARCHAR(80),
    "size" VARCHAR(40),
    "dotWeek" INTEGER,
    "dotYear" INTEGER,
    "fittedDate" TIMESTAMP(3) NOT NULL,
    "fittedOdometer" INTEGER NOT NULL,
    "removedDate" TIMESTAMP(3),
    "removedOdometer" INTEGER,
    "expectedLifeKm" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tyre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TyreInspection" (
    "id" UUID NOT NULL,
    "tyreId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER NOT NULL,
    "treadDepthMm" DECIMAL(4,2),
    "pressurePsi" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TyreInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tyre_vehicleId_removedDate_idx" ON "Tyre"("vehicleId", "removedDate");

-- CreateIndex
CREATE INDEX "Tyre_vehicleId_position_idx" ON "Tyre"("vehicleId", "position");

-- CreateIndex
CREATE INDEX "TyreInspection_vehicleId_inspectedAt_idx" ON "TyreInspection"("vehicleId", "inspectedAt" DESC);

-- CreateIndex
CREATE INDEX "TyreInspection_tyreId_inspectedAt_idx" ON "TyreInspection"("tyreId", "inspectedAt" DESC);

-- AddForeignKey
ALTER TABLE "Tyre" ADD CONSTRAINT "Tyre_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TyreInspection" ADD CONSTRAINT "TyreInspection_tyreId_fkey" FOREIGN KEY ("tyreId") REFERENCES "Tyre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TyreInspection" ADD CONSTRAINT "TyreInspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny-by-default RLS, matching 20260401120000_enable_public_schema_rls and its
-- follow-up: the app reaches Postgres through Prisma as the `postgres` role,
-- which bypasses RLS, so no policies are defined. Without this the tables are
-- reachable through Supabase's PostgREST endpoint.
ALTER TABLE "Tyre" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TyreInspection" ENABLE ROW LEVEL SECURITY;
