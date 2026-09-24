-- Renewals are one thing (#283): a renewal reminder follows the vehicle's
-- paper of its kind. See `src/modules/reminders/renewal-link.ts` for the
-- rules the app applies from here on; this migration applies the same ones
-- to what is already stored.

-- A registration certificate is a renewal too. Nothing below uses the new
-- value, so it is safe in the same migration.
ALTER TYPE "ReminderType" ADD VALUE IF NOT EXISTS 'registration';

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "complianceDocumentId" UUID,
ADD COLUMN     "insurancePolicyId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_insurancePolicyId_key" ON "Reminder"("insurancePolicyId");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_complianceDocumentId_key" ON "Reminder"("complianceDocumentId");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_insurancePolicyId_fkey" FOREIGN KEY ("insurancePolicyId") REFERENCES "InsurancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_complianceDocumentId_fkey" FOREIGN KEY ("complianceDocumentId") REFERENCES "ComplianceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A reminder follows one paper at most.
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_follows_one_paper"
  CHECK ("insurancePolicyId" IS NULL OR "complianceDocumentId" IS NULL);

-- 1. Exact duplicates. Open renewal reminders (insurance, PUC, road tax)
--    that match another on every field someone could have set are the same
--    reminder entered twice: keep the oldest, delete the rest.
DELETE FROM "Reminder" r
USING "Reminder" keep
WHERE r."completedAt" IS NULL
  AND keep."completedAt" IS NULL
  AND r."type" IN ('insurance', 'puc', 'tax')
  AND keep."vehicleId" = r."vehicleId"
  AND keep."type" = r."type"
  AND keep."title" = r."title"
  AND keep."dueDate" IS NOT DISTINCT FROM r."dueDate"
  AND keep."dueOdometer" IS NOT DISTINCT FROM r."dueOdometer"
  AND keep."notes" IS NOT DISTINCT FROM r."notes"
  AND keep."catalogSlug" IS NOT DISTINCT FROM r."catalogSlug"
  AND keep."repeatEveryMonths" IS NOT DISTINCT FROM r."repeatEveryMonths"
  AND keep."repeatEveryKm" IS NOT DISTINCT FROM r."repeatEveryKm"
  AND keep."sourceMaintenanceRecordId" IS NULL
  AND r."sourceMaintenanceRecordId" IS NULL
  AND (keep."createdAt", keep."id") < (r."createdAt", r."id");

-- 2. Link. Each vehicle's paper of record per kind (the latest start date,
--    an undated start ranking lowest; then the later end, open-ended first:
--    `document-recency.ts`), when it has an end date, adopts the vehicle's
--    open renewal reminder of that kind when there is exactly one, and its
--    due date is within 60 days of the paper's end (or it has none). The
--    reminder's date becomes the paper's. Anything else is left as it was.
WITH papers AS (
  SELECT 'insurance'::text AS kind, "id", "vehicleId", "startDate", "endDate", "createdAt"
  FROM "InsurancePolicy"
  UNION ALL
  SELECT "kind"::text, "id", "vehicleId", "startDate", "endDate", "createdAt"
  FROM "ComplianceDocument"
  WHERE "kind" IN ('puc', 'road_tax')
),
latest AS (
  SELECT DISTINCT ON ("vehicleId", kind) kind, "id", "vehicleId", "endDate"
  FROM papers
  ORDER BY "vehicleId", kind, "startDate" DESC NULLS LAST, "endDate" DESC NULLS FIRST,
    "createdAt" DESC
),
open_renewals AS (
  SELECT r."id", r."vehicleId", r."dueDate",
    CASE r."type" WHEN 'insurance' THEN 'insurance' WHEN 'puc' THEN 'puc' ELSE 'road_tax' END
      AS kind
  FROM "Reminder" r
  WHERE r."completedAt" IS NULL
    AND r."type" IN ('insurance', 'puc', 'tax')
    AND r."insurancePolicyId" IS NULL
    AND r."complianceDocumentId" IS NULL
),
single AS (
  SELECT o.*
  FROM open_renewals o
  WHERE (
    SELECT count(*) FROM open_renewals other
    WHERE other."vehicleId" = o."vehicleId" AND other.kind = o.kind
  ) = 1
),
links AS (
  SELECT s."id" AS "reminderId", l.kind, l."id" AS "paperId", l."endDate"
  FROM single s
  JOIN latest l ON l."vehicleId" = s."vehicleId" AND l.kind = s.kind
  WHERE l."endDate" IS NOT NULL
    AND (s."dueDate" IS NULL OR abs(s."dueDate"::date - l."endDate"::date) <= 60)
)
UPDATE "Reminder" r
SET "insurancePolicyId" = CASE WHEN links.kind = 'insurance' THEN links."paperId" END,
    "complianceDocumentId" = CASE WHEN links.kind <> 'insurance' THEN links."paperId" END,
    "dueDate" = links."endDate",
    "status" = CASE
      WHEN links."endDate"::date < (now() AT TIME ZONE 'UTC')::date THEN 'overdue'::"ReminderStatus"
      WHEN links."endDate"::date = (now() AT TIME ZONE 'UTC')::date THEN 'due_today'::"ReminderStatus"
      ELSE 'upcoming'::"ReminderStatus"
    END,
    "updatedAt" = now()
FROM links
WHERE r."id" = links."reminderId";
