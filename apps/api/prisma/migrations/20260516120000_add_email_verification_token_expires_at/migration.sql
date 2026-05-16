-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerificationTokenExpiresAt" TIMESTAMP(3);

-- Backfill: existing unverified users with a pending verification hash get a 7-day grace window
UPDATE "User"
SET "emailVerificationTokenExpiresAt" = NOW() + INTERVAL '7 days'
WHERE "emailVerified" = false
  AND "emailVerificationTokenHash" IS NOT NULL;
