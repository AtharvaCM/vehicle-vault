-- ClaimStatus enum
CREATE TYPE "ClaimStatus" AS ENUM ('filed', 'approved', 'settled', 'rejected');

-- Claim table
CREATE TABLE "Claim" (
  "id"                   UUID            NOT NULL DEFAULT gen_random_uuid(),
  "insurancePolicyId"    UUID            NOT NULL,
  "maintenanceRecordId"  UUID,
  "claimNumber"          VARCHAR(120),
  "grossAmount"          DECIMAL(12, 2)  NOT NULL,
  "insurerPaidAmount"    DECIMAL(12, 2)  NOT NULL,
  "status"               "ClaimStatus"   NOT NULL DEFAULT 'filed',
  "filedDate"            TIMESTAMP(3)    NOT NULL,
  "settledDate"          TIMESTAMP(3),
  "notes"                TEXT,
  "createdAt"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3)    NOT NULL,

  CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- 1:1 claim ↔ maintenance record
CREATE UNIQUE INDEX "Claim_maintenanceRecordId_key"
  ON "Claim" ("maintenanceRecordId")
  WHERE "maintenanceRecordId" IS NOT NULL;

-- Query indexes
CREATE INDEX "Claim_insurancePolicyId_filedDate_idx"
  ON "Claim" ("insurancePolicyId", "filedDate" DESC);

CREATE INDEX "Claim_status_filedDate_idx"
  ON "Claim" ("status", "filedDate" DESC);

-- FKs
ALTER TABLE "Claim"
  ADD CONSTRAINT "Claim_insurancePolicyId_fkey"
  FOREIGN KEY ("insurancePolicyId") REFERENCES "InsurancePolicy"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Claim"
  ADD CONSTRAINT "Claim_maintenanceRecordId_fkey"
  FOREIGN KEY ("maintenanceRecordId") REFERENCES "MaintenanceRecord"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
