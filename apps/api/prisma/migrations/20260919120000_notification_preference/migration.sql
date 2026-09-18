-- Per-kind notification preferences.
--
-- Every alert kind went to every channel for every user; the only controls were
-- a per-device push toggle and, since the unsubscribe work, one switch for all
-- alert email. This table holds a user's choice per kind and channel. A missing
-- row is the default (both channels on), so nothing is backfilled.
--
-- The in-app Notification is always created; these rows only decide which
-- external channels deliver it. The existing "all alert email off" state
-- (User.alertEmailsMutedAt) stays authoritative for email and is kept in step
-- by the API: saving every email toggle off sets it, turning any back on clears it.

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" UUID NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId","kind")
);

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny-by-default RLS, matching 20260401120000_enable_public_schema_rls: Prisma
-- connects as a role that bypasses RLS, so no policies are defined. Without this
-- the table is readable through Supabase's PostgREST endpoint.
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
