import { PrismaClient } from '@prisma/client';

import { syncCatalogAliases } from './catalog-import/sync-catalog-aliases';
import { upsertCatalogDataset } from './catalog-import/upsert-catalog-dataset';
import type { CatalogDataset } from './catalog-import/types';
import { vehicleCatalogSeedData } from './vehicle-catalog.seed-data';

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.vehicleCatalogVariantOffering.deleteMany();
    await tx.vehicleCatalogVariant.deleteMany();
    await tx.vehicleCatalogGeneration.deleteMany();
    await tx.vehicleCatalogModel.deleteMany();
    await tx.vehicleCatalogMake.deleteMany();
    await upsertCatalogDataset(tx, toCatalogDataset(vehicleCatalogSeedData), {
      defaultSourceName: 'curated_seed',
    });
    await syncCatalogAliases(tx);
  });
}

function toCatalogDataset(seedData: typeof vehicleCatalogSeedData): CatalogDataset {
  return seedData.map((make) => ({
    marketCode: make.marketCode,
    vehicleType: make.vehicleType,
    name: make.name,
    sourceUrl: make.sourceUrl,
    models: make.models.map((model) => ({
      name: model.name,
      sourceUrl: model.sourceUrl ?? make.sourceUrl,
      generations: [
        {
          name: `${model.name} lineup`,
          isCurrent: model.variants.some((variant) => variant.isCurrent ?? false),
          sourceUrl: model.sourceUrl ?? make.sourceUrl,
          variants: model.variants.map((variant) => ({
            name: variant.name,
            sourceUrl: variant.sourceUrl ?? model.sourceUrl ?? make.sourceUrl,
            offerings: [
              {
                fuelTypes: variant.fuelTypes,
                yearStart: variant.yearStart,
                yearEnd: variant.yearEnd,
                isCurrent: variant.isCurrent ?? false,
                sourceUrl: variant.sourceUrl ?? model.sourceUrl ?? make.sourceUrl,
              },
            ],
          })),
        },
      ],
    })),
  }));
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
