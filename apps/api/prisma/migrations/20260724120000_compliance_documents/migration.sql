-- CreateEnum
CREATE TYPE "ComplianceDocumentKind" AS ENUM ('registration', 'puc', 'road_tax');

-- AlterEnum
ALTER TYPE "AuditResourceType" ADD VALUE 'compliance_document';

-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "kind" "ComplianceDocumentKind" NOT NULL,
    "provider" VARCHAR(120) NOT NULL,
    "number" VARCHAR(80),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "amount" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceDocument_vehicleId_kind_idx" ON "ComplianceDocument"("vehicleId", "kind");

-- CreateIndex
CREATE INDEX "ComplianceDocument_vehicleId_endDate_idx" ON "ComplianceDocument"("vehicleId", "endDate");

-- AddForeignKey
ALTER TABLE "ComplianceDocument" ADD CONSTRAINT "ComplianceDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny-by-default RLS, same rationale as 20260708120000_enable_rls_remaining_tables:
-- the app connects as `postgres` (bypasses RLS); this only closes PostgREST exposure.
ALTER TABLE "ComplianceDocument" ENABLE ROW LEVEL SECURITY;
