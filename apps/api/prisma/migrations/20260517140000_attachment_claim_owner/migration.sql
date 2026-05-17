-- Add Claim as a 4th polymorphic owner for Attachment.

ALTER TABLE "Attachment"
  ADD COLUMN "claimId" UUID;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_claimId_fkey"
  FOREIGN KEY ("claimId") REFERENCES "Claim"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Attachment_claimId_uploadedAt_idx"
  ON "Attachment" ("claimId", "uploadedAt" DESC);

-- Replace the 3-owner exclusivity check with a 4-owner one.
ALTER TABLE "Attachment"
  DROP CONSTRAINT "attachment_owner_exclusive";

ALTER TABLE "Attachment"
  ADD CONSTRAINT "attachment_owner_exclusive"
  CHECK (
    (
      ("maintenanceRecordId" IS NOT NULL)::int +
      ("insurancePolicyId"   IS NOT NULL)::int +
      ("warrantyId"          IS NOT NULL)::int +
      ("claimId"             IS NOT NULL)::int
    ) = 1
  );
