-- Loosen Attachment ownership to support polymorphic owners
-- (maintenance record, insurance policy, warranty). Slice 1b wires the
-- new FK columns into VehicleDocumentsService; this slice is schema-only.

-- 1. Drop the existing NOT NULL on maintenanceRecordId.
ALTER TABLE "Attachment"
  ALTER COLUMN "maintenanceRecordId" DROP NOT NULL;

-- 2. Add new owner FK columns.
ALTER TABLE "Attachment"
  ADD COLUMN "insurancePolicyId" UUID,
  ADD COLUMN "warrantyId" UUID;

-- 3. FK constraints (ON DELETE CASCADE matches the maintenance-record relation).
ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_insurancePolicyId_fkey"
  FOREIGN KEY ("insurancePolicyId") REFERENCES "InsurancePolicy"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_warrantyId_fkey"
  FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Indexes mirror the existing maintenance-record index shape.
CREATE INDEX "Attachment_insurancePolicyId_uploadedAt_idx"
  ON "Attachment" ("insurancePolicyId", "uploadedAt" DESC);

CREATE INDEX "Attachment_warrantyId_uploadedAt_idx"
  ON "Attachment" ("warrantyId", "uploadedAt" DESC);

-- 5. Exactly-one-owner invariant. An Attachment must belong to a
-- MaintenanceRecord, an InsurancePolicy, or a Warranty — never two,
-- never none.
ALTER TABLE "Attachment"
  ADD CONSTRAINT "attachment_owner_exclusive"
  CHECK (
    (
      ("maintenanceRecordId" IS NOT NULL)::int +
      ("insurancePolicyId"   IS NOT NULL)::int +
      ("warrantyId"          IS NOT NULL)::int
    ) = 1
  );
