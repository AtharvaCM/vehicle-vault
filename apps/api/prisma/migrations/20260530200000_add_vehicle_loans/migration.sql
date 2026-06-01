-- VehicleLoan: per-vehicle financing for true cost-of-ownership.
-- EMI is cached; analytics derives interest accrued via amortization on read.

CREATE TYPE "LoanStatus" AS ENUM ('active', 'closed');

ALTER TYPE "AuditResourceType" ADD VALUE 'vehicle_loan';

CREATE TABLE "VehicleLoan" (
  "id"            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId"    UUID            NOT NULL,
  "lender"       VARCHAR(120)    NOT NULL,
  "accountNumber" VARCHAR(80),
  "principal"    DECIMAL(12, 2)  NOT NULL,
  "interestRate" DECIMAL(6, 3)   NOT NULL,
  "tenureMonths" INTEGER         NOT NULL,
  "startDate"    TIMESTAMP(3)    NOT NULL,
  "emiAmount"    DECIMAL(12, 2)  NOT NULL,
  "currencyCode" VARCHAR(3)      NOT NULL DEFAULT 'INR',
  "status"       "LoanStatus"    NOT NULL DEFAULT 'active',
  "closedAt"     TIMESTAMP(3),
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)    NOT NULL,
  CONSTRAINT "VehicleLoan_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE
);

CREATE INDEX "VehicleLoan_vehicleId_startDate_idx"
  ON "VehicleLoan" ("vehicleId", "startDate" DESC);
CREATE INDEX "VehicleLoan_vehicleId_status_idx"
  ON "VehicleLoan" ("vehicleId", "status");
