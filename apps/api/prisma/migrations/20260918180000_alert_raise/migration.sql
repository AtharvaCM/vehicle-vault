-- A record of each alert NotifyService raised under a cooldown, and what the
-- cooldown reads from now on instead of the Notification table.
--
-- 1.27.0 stopped the two cold-start prompts (`tyre-uninspected` for a vehicle
-- with no tyres on file, and vehicle-scope `service-baseline-unknown`) from
-- being asked twice in 90 days by looking for an earlier Notification row.
-- Deleting a notification removes its row, so a prompt someone deleted — the
-- clearest "stop asking" a user can give — left the cooldown nothing to find,
-- and the next morning's run asked again.
--
-- Soft-deleting notifications instead would have meant teaching every
-- notification query to skip deleted rows (the list, the unread count, mark
-- read and mark all read, the per-document and per-reminder mark-read, the
-- lookup that answers a dedup collision), and a deleted unread row would still
-- hold its slot in `notification_dedup_unread` unless that index grew a new
-- predicate.
-- It would also keep the text of a notification its owner asked to delete. The
-- cooldown's question is what the app has already asked someone, not what is
-- in their inbox, so it gets a table that answers that and nothing else.
--
-- Deliberately no foreign key to Notification: a row here has to outlive the
-- notification it produced. It goes with its user or its vehicle and is
-- otherwise never updated or deleted. Only a raise with a cooldown writes one;
-- every other alert behaves exactly as before.

-- CreateTable
CREATE TABLE "AlertRaise" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vehicleId" UUID,
    "kind" VARCHAR(60) NOT NULL,
    "dedupKey" VARCHAR(160) NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRaise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertRaise_userId_vehicleId_kind_raisedAt_idx" ON "AlertRaise"("userId", "vehicleId", "kind", "raisedAt" DESC);

-- CreateIndex
CREATE INDEX "AlertRaise_vehicleId_idx" ON "AlertRaise"("vehicleId");

-- AddForeignKey
ALTER TABLE "AlertRaise" ADD CONSTRAINT "AlertRaise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRaise" ADD CONSTRAINT "AlertRaise_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over every cold-start prompt already in someone's inbox. Without this
-- the cooldown would start empty, and the first run after the deploy would ask
-- again every prompt that has been read. One deleted before this migration has
-- left nothing to copy, and is asked again at most once more.
--
-- Matched on the dedup keys the two templates build (`<kind>:<vehicle>:untracked:<bucket>`
-- and `<kind>:<vehicle>:vehicle:<bucket>`), because the stale-tyre reminder and
-- the category-scope baseline alert share these kinds and are raised without a
-- cooldown. Joined to Vehicle because Notification.vehicleId has no foreign key
-- and can still name a vehicle that has since been deleted, which the new
-- foreign key would refuse.
INSERT INTO "AlertRaise" ("id", "userId", "vehicleId", "kind", "dedupKey", "raisedAt")
SELECT gen_random_uuid(), n."userId", n."vehicleId", n."kind", n."dedupKey", n."createdAt"
FROM "Notification" n
JOIN "Vehicle" v ON v."id" = n."vehicleId"
WHERE (n."kind" = 'tyre-uninspected' AND n."dedupKey" LIKE 'tyre-uninspected:%:untracked:%')
   OR (n."kind" = 'service-baseline-unknown' AND n."dedupKey" LIKE 'service-baseline-unknown:%:vehicle:%');

-- Deny-by-default RLS, matching 20260401120000_enable_public_schema_rls: the app
-- reaches Postgres through Prisma as the `postgres` role, which bypasses RLS, so
-- no policies are defined. Without this the table is reachable through
-- Supabase's PostgREST endpoint.
ALTER TABLE "AlertRaise" ENABLE ROW LEVEL SECURITY;
