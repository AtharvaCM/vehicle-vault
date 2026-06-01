-- LoanPrepayment: lump-sum payments that reduce a vehicle loan's outstanding
-- principal mid-tenure. Amortization re-projects on every read.

ALTER TYPE "AuditResourceType" ADD VALUE 'loan_prepayment';

CREATE TABLE "LoanPrepayment" (
  "id"        UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  "loanId"    UUID           NOT NULL,
  "date"      TIMESTAMP(3)   NOT NULL,
  "amount"    DECIMAL(12, 2) NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "LoanPrepayment_loanId_fkey"
    FOREIGN KEY ("loanId") REFERENCES "VehicleLoan"("id") ON DELETE CASCADE
);

CREATE INDEX "LoanPrepayment_loanId_date_idx"
  ON "LoanPrepayment" ("loanId", "date" DESC);
