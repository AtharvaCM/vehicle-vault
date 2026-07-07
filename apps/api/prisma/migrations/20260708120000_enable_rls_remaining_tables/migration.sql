-- Follow-up to 20260401120000_enable_public_schema_rls.
-- These tables were added after that migration and never had RLS enabled,
-- leaving them reachable through Supabase's PostgREST endpoint. This app
-- talks to Postgres through Prisma (connecting as the `postgres` role, which
-- bypasses RLS), so — as with the earlier migration — we deny-by-default with
-- no policies rather than model client-side access we don't use.

ALTER TABLE "VehicleMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VehicleInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Claim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VehicleLoan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoanPrepayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MaintenancePartCatalog" ENABLE ROW LEVEL SECURITY;
