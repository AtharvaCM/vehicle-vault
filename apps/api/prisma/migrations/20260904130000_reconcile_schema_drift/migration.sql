-- Reconcile pre-existing drift between migration history and schema.prisma.
-- Nothing here changes app behavior; it closes gaps left by hand-written
-- SQL in earlier migrations so `prisma migrate diff` reads clean again.

-- 1. `@default(uuid())` / `@updatedAt` are Prisma-managed (client-side)
--    defaults -- the app always supplies these values, so Prisma never
--    expects a DB-level default for them. A handful of hand-written
--    migrations added `DEFAULT gen_random_uuid()` / `DEFAULT
--    CURRENT_TIMESTAMP` anyway, unlike the other uuid-keyed / @updatedAt
--    tables. Drop the redundant DB defaults for consistency.
ALTER TABLE "AuditEvent" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Claim" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "LoanPrepayment" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "MaintenancePartCatalog" ALTER COLUMN "id" DROP DEFAULT, ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "OAuthAccount" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "VehicleInvite" ALTER COLUMN "id" DROP DEFAULT, ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "VehicleLoan" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "VehicleMember" ALTER COLUMN "id" DROP DEFAULT, ALTER COLUMN "updatedAt" DROP DEFAULT;

-- 2. These three FKs were hand-written without an explicit ON UPDATE
--    action, so Postgres defaulted to NO ACTION. Every other FK in the
--    schema uses ON UPDATE CASCADE, matching Prisma's implicit default for
--    relations that don't set `onUpdate` explicitly. Primary keys are
--    immutable UUIDs in practice, so this has no real-world effect -- it
--    just removes a false drift signal and keeps referential actions
--    consistent across the schema.
ALTER TABLE "VehicleLoan" DROP CONSTRAINT "VehicleLoan_vehicleId_fkey";
ALTER TABLE "VehicleLoan" ADD CONSTRAINT "VehicleLoan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoanPrepayment" DROP CONSTRAINT "LoanPrepayment_loanId_fkey";
ALTER TABLE "LoanPrepayment" ADD CONSTRAINT "LoanPrepayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "VehicleLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_catalogGenerationId_fkey";
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_catalogGenerationId_fkey" FOREIGN KEY ("catalogGenerationId") REFERENCES "VehicleCatalogGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. `Claim.maintenanceRecordId` is `@unique` in schema.prisma, which Prisma
--    maps to a plain (non-partial) unique index. The original migration
--    instead created a partial index (`WHERE ... IS NOT NULL`), presumably
--    to skip indexing not-yet-linked claims. Prisma's schema language can't
--    express a partial index, so this permanently reads as drift, and
--    `prisma migrate dev` would try to "fix" it the same way anyway. A
--    plain unique index behaves identically for the app: Postgres already
--    treats NULLs as distinct in a unique index, so multiple claims without
--    a maintenanceRecordId remain allowed. The only cost is indexing the
--    null rows too, negligible at this table's scale.
DROP INDEX "Claim_maintenanceRecordId_key";
CREATE UNIQUE INDEX "Claim_maintenanceRecordId_key" ON "Claim"("maintenanceRecordId");
