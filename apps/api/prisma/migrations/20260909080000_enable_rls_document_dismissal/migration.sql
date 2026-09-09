-- Follow-up to 20260708120000_enable_rls_remaining_tables.
-- DocumentDismissal was added in 20260904120000_add_document_dismissal and
-- never had RLS enabled, leaving it readable and writable through Supabase's
-- PostgREST endpoint by anyone holding the project URL. This app talks to
-- Postgres through Prisma (connecting as the `postgres` role, which bypasses
-- RLS), so — as with the earlier migrations — we deny-by-default with no
-- policies rather than model client-side access we don't use.

ALTER TABLE "DocumentDismissal" ENABLE ROW LEVEL SECURITY;
