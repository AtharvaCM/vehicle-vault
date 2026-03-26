import { createHash } from 'node:crypto';

import { PrismaClient, CatalogImportRunStatus } from '@prisma/client';

import {
  catalogImportSources,
  type CatalogImportSourceKey,
} from './catalog-import/source-registry';

const prisma = new PrismaClient();

async function main() {
  const { sourceKeys, shouldPublish } = readArgs();

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

      if (shouldPublish) {
        // Automatically publish the run by upserting the dataset into the catalog tables
        const { upsertCatalogDataset } = await import('./catalog-import/upsert-catalog-dataset');
        const { syncCatalogAliases } = await import('./catalog-import/sync-catalog-aliases');

        const recordsUpserted = await upsertCatalogDataset(prisma, source.dataset, {
          defaultSourceName: source.sourceKey,
        });
        await syncCatalogAliases(prisma);

        await prisma.vehicleCatalogImportRun.update({
          where: {
            id: run.id,
          },
          data: {
            completedAt: new Date(),
            snapshotCount: 1,
            status: CatalogImportRunStatus.succeeded,
            publishedAt: new Date(),
            recordsUpserted,
          },
        });
      } else {
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
      }
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

function readArgs() {
  const sourceArg = process.argv.find((argument) => argument.startsWith('--source='));
  const rawSourceKey = sourceArg?.split('=')[1];
  const shouldPublish = process.argv.includes('--publish');

  if (rawSourceKey === 'all') {
    return {
      sourceKeys: Object.keys(catalogImportSources) as CatalogImportSourceKey[],
      shouldPublish,
    };
  }

  const sourceKey = rawSourceKey as CatalogImportSourceKey | undefined;

  if (!sourceKey || !(sourceKey in catalogImportSources)) {
    throw new Error(
      `Unknown or missing source. Supported sources: ${Object.keys(catalogImportSources).join(', ')}, all`,
    );
  }

  return {
    sourceKeys: [sourceKey],
    shouldPublish,
  };
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
