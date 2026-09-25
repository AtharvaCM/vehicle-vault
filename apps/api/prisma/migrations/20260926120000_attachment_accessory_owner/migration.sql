-- Add Accessory as a 7th polymorphic owner for Attachment (#336).
-- Use case: the receipt for a dashcam, a seat cover or a phone mount, kept with
-- the accessory as a service record keeps its bill.
--
-- No new table, so no new RLS: "Attachment" already has row level security
-- enabled (20260401120000_enable_public_schema_rls), and a new column inherits it.

ALTER TABLE "Attachment"
  ADD COLUMN "accessoryId" UUID;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_accessoryId_fkey"
  FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Attachment_accessoryId_uploadedAt_idx"
  ON "Attachment" ("accessoryId", "uploadedAt" DESC);

-- Replace 6-owner exclusivity check with 7-owner: still exactly one owner.
ALTER TABLE "Attachment"
  DROP CONSTRAINT "attachment_owner_exclusive";

ALTER TABLE "Attachment"
  ADD CONSTRAINT "attachment_owner_exclusive"
  CHECK (
    (
      ("maintenanceRecordId"  IS NOT NULL)::int +
      ("insurancePolicyId"    IS NOT NULL)::int +
      ("warrantyId"           IS NOT NULL)::int +
      ("claimId"              IS NOT NULL)::int +
      ("vehicleLoanId"        IS NOT NULL)::int +
      ("complianceDocumentId" IS NOT NULL)::int +
      ("accessoryId"          IS NOT NULL)::int
    ) = 1
  );
