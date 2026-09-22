-- Add ComplianceDocument as a 6th polymorphic owner for Attachment.
-- Use case: the registration certificate, PUC certificate and road tax receipt,
-- which are the documents most likely to be asked for at a checkpoint, kept
-- with the record of them as insurance policies and warranties already are.
--
-- No new table, so no new RLS: "Attachment" already has row level security
-- enabled (20260401120000_enable_public_schema_rls), and a new column inherits it.

ALTER TABLE "Attachment"
  ADD COLUMN "complianceDocumentId" UUID;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_complianceDocumentId_fkey"
  FOREIGN KEY ("complianceDocumentId") REFERENCES "ComplianceDocument"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Attachment_complianceDocumentId_uploadedAt_idx"
  ON "Attachment" ("complianceDocumentId", "uploadedAt" DESC);

-- Replace 5-owner exclusivity check with 6-owner: still exactly one owner.
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
      ("complianceDocumentId" IS NOT NULL)::int
    ) = 1
  );
