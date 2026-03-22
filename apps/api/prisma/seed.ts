import { PrismaClient } from '@prisma/client';

import { vehicleCatalogSeedData } from './vehicle-catalog.seed-data';

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.vehicleCatalogVariant.deleteMany();
    await tx.vehicleCatalogModel.deleteMany();
    await tx.vehicleCatalogMake.deleteMany();

    for (const make of vehicleCatalogSeedData) {
      const createdMake = await tx.vehicleCatalogMake.create({
        data: {
          marketCode: make.marketCode,
          vehicleType: make.vehicleType,
          name: make.name,
          slug: slugify(make.name),
          sourceName: 'curated_seed',
          sourceUrl: make.sourceUrl,
        },
      });

      for (const model of make.models) {
        const createdModel = await tx.vehicleCatalogModel.create({
          data: {
            makeId: createdMake.id,
            name: model.name,
            slug: slugify(model.name),
            sourceName: 'curated_seed',
            sourceUrl: model.sourceUrl ?? make.sourceUrl,
          },
        });

        for (const variant of model.variants) {
          await tx.vehicleCatalogVariant.create({
            data: {
              modelId: createdModel.id,
              name: variant.name,
              slug: slugify(variant.name),
              fuelTypes: variant.fuelTypes,
              yearStart: variant.yearStart,
              yearEnd: variant.yearEnd,
              isCurrent: variant.isCurrent ?? false,
              sourceName: 'curated_seed',
              sourceUrl: variant.sourceUrl ?? model.sourceUrl ?? make.sourceUrl,
            },
          });
        }
      }
    }
  });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
