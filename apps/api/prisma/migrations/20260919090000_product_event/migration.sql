-- Product telemetry, v1.
--
-- The app could not answer whether anyone signs up, adds a vehicle, logs a
-- service, or opens an alert: nothing recorded any of it, and every figure in
-- the September direction memo had to be derived from row counts. This table is
-- the record of those moments — append-only, written server-side next to the
-- audit event of the same action, and read back only as aggregate counts.
--
-- Deliberately not a copy of AuditEvent. The audit trail answers "what happened
-- to this record, and who did it", with before/after payloads; this answers
-- "how many people did this, and when", with no payload beyond a few non-personal
-- properties. User and vehicle go null on delete so the counts survive an
-- account deletion without keeping anything that identifies the account.

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "vehicleId" UUID,
    "name" VARCHAR(60) NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductEvent_name_occurredAt_idx" ON "ProductEvent"("name", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "ProductEvent_occurredAt_idx" ON "ProductEvent"("occurredAt" DESC);

-- CreateIndex
CREATE INDEX "ProductEvent_userId_idx" ON "ProductEvent"("userId");

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- "First" means first ever. A user's first confirmed service log or fuel log is
-- recorded once, and deleting that record does not make the next one first
-- again — so the marker has to be the event itself, enforced here rather than by
-- a read-then-write that two concurrent requests could both pass. Writers insert
-- with ON CONFLICT DO NOTHING (`createMany({ skipDuplicates: true })`): a plain
-- insert hitting this index would abort the whole transaction, and with it the
-- record the user was saving. NULL user ids (deleted accounts) never collide.
CREATE UNIQUE INDEX "ProductEvent_userId_first_event_key"
    ON "ProductEvent"("userId", "name")
    WHERE "name" IN ('first_maintenance_logged', 'first_fuel_logged');

-- Deny-by-default RLS, matching 20260401120000_enable_public_schema_rls: Prisma
-- connects as a role that bypasses RLS, so no policies are defined. Without this
-- the table is readable through Supabase's PostgREST endpoint.
ALTER TABLE "ProductEvent" ENABLE ROW LEVEL SECURITY;
