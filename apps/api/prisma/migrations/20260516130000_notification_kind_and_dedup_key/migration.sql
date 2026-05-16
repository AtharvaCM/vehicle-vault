-- AlterTable
ALTER TABLE "Notification"
  ADD COLUMN "kind" VARCHAR(60) NOT NULL DEFAULT 'legacy',
  ADD COLUMN "dedupKey" VARCHAR(160);

-- Index for kind-scoped queries (e.g. AlertEngine listing recent maintenance-due rows)
CREATE INDEX "Notification_userId_kind_createdAt_idx"
  ON "Notification" ("userId", "kind", "createdAt" DESC);

-- Partial unique index enforces "at most one unread notification per (user, dedupKey)".
-- Read notifications are exempt so a user can be alerted again after acknowledging.
CREATE UNIQUE INDEX "notification_dedup_unread"
  ON "Notification" ("userId", "dedupKey")
  WHERE "isRead" = false AND "dedupKey" IS NOT NULL;
