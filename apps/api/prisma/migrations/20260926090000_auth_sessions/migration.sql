-- Signed-in sessions, one row per device (#316).
--
-- Until now a user held a single refresh-token hash, so signing in on a second
-- device signed the first one out at its next refresh, and there was nothing
-- to list. Each session now keeps its own hash, rotated on every refresh.

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" CHAR(64) NOT NULL,
    "userAgent" VARCHAR(400),
    "location" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_lastActiveAt_idx" ON "AuthSession"("userId", "lastActiveAt" DESC);

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry each signed-in user's current refresh token over as a session, so the
-- deploy signs nobody out: the token presented next is looked up by its hash.
-- What device it is was never stored, so the row starts without one.
INSERT INTO "AuthSession" ("id", "userId", "refreshTokenHash", "createdAt", "lastActiveAt")
SELECT gen_random_uuid(), "id", "refreshTokenHash", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "refreshTokenHash" IS NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "refreshTokenHash";

-- Deny-by-default RLS, matching 20260401120000_enable_public_schema_rls: the app
-- reaches Postgres through Prisma as the `postgres` role, which bypasses RLS, so
-- no policies are defined. Without this the table is reachable through
-- Supabase's PostgREST endpoint.
ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;
