-- Add VehicleLoan as a 5th polymorphic owner for Attachment.
-- Use case: sanction letter, loan agreement, EMI statements, NOC.

ALTER TABLE "Attachment"
  ADD COLUMN "vehicleLoanId" UUID;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_vehicleLoanId_fkey"
  FOREIGN KEY ("vehicleLoanId") REFERENCES "VehicleLoan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Attachment_vehicleLoanId_uploadedAt_idx"
  ON "Attachment" ("vehicleLoanId", "uploadedAt" DESC);

-- Replace 4-owner exclusivity check with 5-owner.
ALTER TABLE "Attachment"
  DROP CONSTRAINT "attachment_owner_exclusive";

ALTER TABLE "Attachment"
  ADD CONSTRAINT "attachment_owner_exclusive"
  CHECK (
    (
      ("maintenanceRecordId" IS NOT NULL)::int +
      ("insurancePolicyId"   IS NOT NULL)::int +
      ("warrantyId"          IS NOT NULL)::int +
      ("claimId"             IS NOT NULL)::int +
      ("vehicleLoanId"       IS NOT NULL)::int
    ) = 1
  );
