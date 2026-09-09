import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Supabase exposes the `public` schema through PostgREST, so every table in it
 * must have row level security enabled — see
 * `20260401120000_enable_public_schema_rls`. Three tables have shipped without
 * it so far (VehicleMember and friends, then DocumentDismissal), each time
 * caught only by the Supabase advisor days later. This runs in CI against the
 * freshly migrated database so a new table without RLS fails the pull request.
 */
async function main() {
  const unprotected = await prisma.$queryRaw<{ table: string }[]>`
    SELECT c.relname AS "table"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
    ORDER BY c.relname
  `;

  if (unprotected.length > 0) {
    console.error(
      `Row level security is not enabled on ${unprotected.length} table(s) in the public schema:`,
    );

    for (const { table } of unprotected) {
      console.error(`  - ${table}`);
    }

    console.error(
      '\nAdd a migration enabling RLS on them, for example:\n' +
        unprotected
          .map(({ table }) => `  ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`)
          .join('\n'),
    );

    process.exitCode = 1;
    return;
  }

  console.log('Row level security is enabled on every table in the public schema.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
