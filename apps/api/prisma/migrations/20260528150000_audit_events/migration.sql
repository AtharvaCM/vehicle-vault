-- Immutable audit trail for mutations and auth events. See ADR-0004.

CREATE TYPE "AuditResourceType" AS ENUM (
  'vehicle',
  'maintenance_record',
  'reminder',
  'insurance_policy',
  'warranty',
  'claim',
  'fuel_log',
  'user',
  'oauth_account',
  'attachment'
);

CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" UUID,
  "ownerUserId" UUID,
  "action" VARCHAR(80) NOT NULL,
  "resourceType" "AuditResourceType",
  "resourceId" UUID,
  "before" JSONB,
  "after" JSONB,
  "changedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ipAddress" INET,
  "userAgent" VARCHAR(500),

  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AuditEvent_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AuditEvent_ownerUserId_occurredAt_idx"
  ON "AuditEvent" ("ownerUserId", "occurredAt" DESC);

CREATE INDEX "AuditEvent_actorUserId_occurredAt_idx"
  ON "AuditEvent" ("actorUserId", "occurredAt" DESC);

CREATE INDEX "AuditEvent_resourceType_resourceId_occurredAt_idx"
  ON "AuditEvent" ("resourceType", "resourceId", "occurredAt" DESC);

CREATE INDEX "AuditEvent_action_occurredAt_idx"
  ON "AuditEvent" ("action", "occurredAt" DESC);

CREATE INDEX "AuditEvent_ipAddress_idx" ON "AuditEvent" ("ipAddress");
