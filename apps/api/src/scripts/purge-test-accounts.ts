/**
 * Removes the accounts the e2e suite left in production (#93).
 *
 * Run inside the API container, where the environment is already in place:
 *
 *   node dist/src/scripts/purge-test-accounts.js
 *     Dry run. Lists every account — the shortlist of test-looking addresses
 *     with what deleting each would remove, and every account that stays — plus
 *     the stored files no row points at. Deletes nothing.
 *
 *   node dist/src/scripts/purge-test-accounts.js --execute --ids=<id>,<id>,...
 *     Deletes exactly the reviewed ids, through AccountDeletionService, and
 *     their product events with them: test traffic is what #93 removes from
 *     the counts, where a real account's events stay behind anonymised.
 *
 * Execution takes ids rather than re-running the pattern: a pattern evaluated
 * at delete time could sweep up an account nobody reviewed. Each id must still
 * look like a test address, which guards against pasting a real one.
 */
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { PrismaModule } from '../common/prisma/prisma.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { SupabaseStorageModule } from '../common/storage/supabase-storage.module';
import { AppConfigModule } from '../config/app-config.module';
import {
  ATTACHMENT_STORAGE_ROOTS,
  AccountDeletionService,
  type AccountDeletionPlan,
} from '../modules/users/account-deletion.service';
import { testAccountSignals } from '../modules/users/test-account-signals';
import { UsersModule } from '../modules/users/users.module';

/** Just what deletion needs: no HTTP, and none of the cron jobs AppModule schedules. */
@Module({ imports: [AppConfigModule, PrismaModule, SupabaseStorageModule, UsersModule] })
class PurgeTestAccountsModule {}

type Options = { execute: boolean; ids: string[] };

export function parseOptions(argv: string[]): Options {
  const execute = argv.includes('--execute');
  const idsArg = argv.find((arg) => arg.startsWith('--ids='));
  const ids = idsArg
    ? idsArg
        .slice('--ids='.length)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  if (execute && ids.length === 0) {
    throw new Error('--execute needs --ids=<id>,<id>,... taken from a reviewed dry run.');
  }
  if (!execute && ids.length > 0) {
    throw new Error('--ids only means something with --execute.');
  }

  return { execute, ids };
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function describe(plan: AccountDeletionPlan, signals: string[]): string {
  const shared = plan.ownedVehicles.filter((vehicle) => vehicle.otherMembers > 0).length;
  const stray = plan.storedObjects.length - plan.attachmentFiles.length;
  return [
    `  ${plan.userId}  ${plan.email}`,
    `      created ${day(plan.createdAt)} · signals: ${signals.join(', ')}`,
    `      vehicles ${plan.ownedVehicles.length}${shared ? ` (${shared} SHARED — blocks deletion)` : ''}` +
      ` · files ${plan.attachmentFiles.length}${stray > 0 ? ` (+${stray} stray under their prefix)` : ''}` +
      ` · audit rows ${plan.auditEvents} · notifications ${plan.notifications}` +
      ` · product events ${plan.productEvents} · memberships elsewhere ${plan.otherMemberships}`,
  ].join('\n');
}

async function dryRun(prisma: PrismaService, deletion: AccountDeletionService) {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const candidates = users.filter((user) => testAccountSignals(user.email).length > 0);
  const kept = users.filter((user) => testAccountSignals(user.email).length === 0);

  console.log(
    `Accounts: ${users.length} in total — ${candidates.length} look like test accounts, ${kept.length} would stay.\n`,
  );

  const deletable: string[] = [];
  console.log('Shortlisted for deletion:');
  for (const candidate of candidates) {
    const plan = await deletion.plan(candidate.id);
    console.log(describe(plan, testAccountSignals(candidate.email)));
    if (plan.ownedVehicles.every((vehicle) => vehicle.otherMembers === 0)) {
      deletable.push(candidate.id);
    }
  }

  console.log('\nStaying:');
  for (const user of kept) {
    console.log(`  ${user.id}  ${user.email}  created ${day(user.createdAt)}`);
  }

  const orphans = await deletion.findOrphanedObjects(ATTACHMENT_STORAGE_ROOTS);
  console.log(`\nStored files with no row pointing at them, across the bucket: ${orphans.length}`);
  for (const path of orphans) console.log(`  ${path}`);

  if (deletable.length < candidates.length) {
    console.log(
      `\n${candidates.length - deletable.length} shortlisted account(s) own a shared vehicle and are left out below.`,
    );
  }
  console.log('\nNothing was deleted. After review, delete exactly the shortlist with:');
  console.log(
    `  node dist/src/scripts/purge-test-accounts.js --execute --ids=${deletable.join(',')}`,
  );
}

async function execute(prisma: PrismaService, deletion: AccountDeletionService, ids: string[]) {
  // Check every id before deleting any, so a bad paste deletes nothing.
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true },
  });
  const found = new Map(users.map((user) => [user.id, user]));
  const missing = ids.filter((id) => !found.has(id));
  const realLooking = users.filter((user) => testAccountSignals(user.email).length === 0);

  if (missing.length > 0 || realLooking.length > 0) {
    for (const id of missing) console.error(`No account with id ${id}.`);
    for (const user of realLooking) {
      console.error(`Refusing ${user.id} (${user.email}): it does not look like a test account.`);
    }
    throw new Error('Nothing was deleted.');
  }

  let failures = 0;
  for (const id of ids) {
    const email = found.get(id)?.email;
    try {
      // A real person's telemetry outlives their account, anonymised, so the
      // counts stay true. A test account's never was true: it goes with it.
      const { count: productEvents } = await prisma.productEvent.deleteMany({
        where: { userId: id },
      });
      const result = await deletion.deleteAccount(id);
      console.log(
        `Deleted ${id} (${email}): ${result.vehiclesDeleted} vehicle(s), ${result.filesDeleted} file(s)` +
          `${result.filesAlreadyGone ? `, ${result.filesAlreadyGone} already gone` : ''}` +
          `${result.orphansDeleted ? `, ${result.orphansDeleted} stray file(s)` : ''}` +
          `${productEvents ? `, ${productEvents} product event(s)` : ''}` +
          `${result.storageFailures.length ? ` — could not remove: ${result.storageFailures.join(', ')}` : ''}`,
      );
      if (result.storageFailures.length > 0) failures += 1;
    } catch (error) {
      failures += 1;
      console.error(`Could not delete ${id} (${email}): ${(error as Error).message}`);
    }
  }

  const remaining = await prisma.user.count();
  const orphans = await deletion.findOrphanedObjects(ATTACHMENT_STORAGE_ROOTS);
  console.log(`\nAccounts remaining: ${remaining}`);
  console.log(`Stored files with no row pointing at them, across the bucket: ${orphans.length}`);
  for (const path of orphans) console.log(`  ${path}`);

  if (failures > 0) {
    throw new Error(`${failures} account(s) did not delete cleanly; see above.`);
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(PurgeTestAccountsModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const deletion = app.get(AccountDeletionService);

    if (options.execute) {
      await execute(prisma, deletion, options.ids);
    } else {
      await dryRun(prisma, deletion);
    }
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
