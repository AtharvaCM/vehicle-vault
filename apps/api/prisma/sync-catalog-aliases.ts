import { PrismaClient } from '@prisma/client';

import { syncCatalogAliases } from './catalog-import/sync-catalog-aliases';

const prisma = new PrismaClient();

async function main() {
  const syncedCount = await syncCatalogAliases(prisma);
  console.info(`Synced ${syncedCount} catalog aliases.`);
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
