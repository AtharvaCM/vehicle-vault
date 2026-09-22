-- A document known only by its expiry, and the prompt that collects one.
--
-- A new vehicle now lands on a two-date prompt: insurance expiry and PUC expiry.
-- Those are the dates an owner knows without fetching paperwork, and the expiry
-- is the only field the alerts read — so a record may now exist without the
-- issuer, the policy number, or a start date. Scanning the document, or editing
-- it later, fills the rest in. Warranty is unchanged; it is not in the prompt.

-- AlterTable
ALTER TABLE "InsurancePolicy" ALTER COLUMN "provider" DROP NOT NULL;
ALTER TABLE "InsurancePolicy" ALTER COLUMN "policyNumber" DROP NOT NULL;
ALTER TABLE "InsurancePolicy" ALTER COLUMN "startDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ComplianceDocument" ALTER COLUMN "provider" DROP NOT NULL;
ALTER TABLE "ComplianceDocument" ALTER COLUMN "startDate" DROP NOT NULL;

-- Answered or skipped, the prompt does not come back for that vehicle.
-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "setupPromptDismissedAt" TIMESTAMP(3);
