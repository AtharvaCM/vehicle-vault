import { createHash } from 'node:crypto';

import { PrismaClient, CatalogImportRunStatus } from '@prisma/client';

import { upsertCatalogDataset } from './catalog-import/upsert-catalog-dataset';
import { hyundaiIndiaSnapshot } from './catalog-import/sources/hyundai-india.snapshot';

const prisma = new PrismaClient();

const sources = {
  'hyundai-india': hyundaiIndiaSnapshot,
} as const;

async function main() {
  const sourceKey = readSourceKeyArg();
  const source = sources[sourceKey];

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

    const recordsUpserted = await prisma.$transaction((tx) =>
      upsertCatalogDataset(tx, source.dataset, {
        defaultSourceName: source.sourceKey,
      }),
    );

    await prisma.vehicleCatalogImportRun.update({
      where: {
        id: run.id,
      },
      data: {
        completedAt: new Date(),
        recordsUpserted,
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

function readSourceKeyArg() {
  const sourceArg = process.argv.find((argument) => argument.startsWith('--source='));
  const sourceKey = sourceArg?.split('=')[1] as keyof typeof sources | undefined;

  if (!sourceKey || !(sourceKey in sources)) {
    throw new Error(`Unknown or missing source. Supported sources: ${Object.keys(sources).join(', ')}`);
  }

  return sourceKey;
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
