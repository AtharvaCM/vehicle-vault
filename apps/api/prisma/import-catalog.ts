import { createHash } from 'node:crypto';

import { PrismaClient, CatalogImportRunStatus } from '@prisma/client';

import { catalogImportSources, type CatalogImportSourceKey } from './catalog-import/source-registry';

const prisma = new PrismaClient();

async function main() {
  const sourceKeys = readSourceKeysArg();

  for (const sourceKey of sourceKeys) {
    const source = catalogImportSources[sourceKey];
    const run = await prisma.vehicleCatalogImportRun.create({
      data: {
        sourceKey: source.sourceKey,
        marketCode: source.marketCode,
        status: CatalogImportRunStatus.running,
      },
    });

    try {
      const payload = {
        capturedAt: source.capturedAt,
        dataset: source.dataset,
        sourceKey: source.sourceKey,
        sourceUrl: source.sourceUrl,
      };

      await prisma.vehicleCatalogImportSnapshot.create({
        data: {
          importRunId: run.id,
          sourceUrl: source.sourceUrl,
          sourceHash: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
          payload,
        },
      });

      await prisma.vehicleCatalogImportRun.update({
        where: {
          id: run.id,
        },
        data: {
          completedAt: new Date(),
          snapshotCount: 1,
          status: CatalogImportRunStatus.succeeded,
        },
      });
    } catch (error) {
      await prisma.vehicleCatalogImportRun.update({
        where: {
          id: run.id,
        },
        data: {
          completedAt: new Date(),
          notes: error instanceof Error ? error.message : 'Unknown catalog import failure',
          status: CatalogImportRunStatus.failed,
        },
      });

      throw error;
    }
  }
}

function readSourceKeysArg() {
  const sourceArg = process.argv.find((argument) => argument.startsWith('--source='));
  const rawSourceKey = sourceArg?.split('=')[1];

  if (rawSourceKey === 'all') {
    return Object.keys(catalogImportSources) as CatalogImportSourceKey[];
  }

  const sourceKey = rawSourceKey as CatalogImportSourceKey | undefined;

  if (!sourceKey || !(sourceKey in catalogImportSources)) {
    throw new Error(
      `Unknown or missing source. Supported sources: ${Object.keys(catalogImportSources).join(', ')}, all`,
    );
  }

  return [sourceKey];
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
