import type { Prisma, PrismaClient } from '@prisma/client';

import type { CatalogDataset } from './types';

type CatalogWriter = PrismaClient | Prisma.TransactionClient;

type UpsertCatalogDatasetOptions = {
  defaultSourceName: string;
};

export async function upsertCatalogDataset(
  prisma: CatalogWriter,
  dataset: CatalogDataset,
  { defaultSourceName }: UpsertCatalogDatasetOptions,
) {
  let recordsUpserted = 0;

  for (const make of dataset) {
    const makeRecord = await prisma.vehicleCatalogMake.upsert({
      where: {
        marketCode_vehicleType_slug: {
          marketCode: make.marketCode,
          vehicleType: make.vehicleType,
          slug: slugify(make.name),
        },
      },
      update: {
        name: make.name,
        sourceName: defaultSourceName,
        sourceUrl: make.sourceUrl,
      },
      create: {
        marketCode: make.marketCode,
        vehicleType: make.vehicleType,
        name: make.name,
        slug: slugify(make.name),
        sourceName: defaultSourceName,
        sourceUrl: make.sourceUrl,
      },
    });
    recordsUpserted += 1;

    for (const model of make.models) {
      const modelRecord = await prisma.vehicleCatalogModel.upsert({
        where: {
          makeId_slug: {
            makeId: makeRecord.id,
            slug: slugify(model.name),
          },
        },
        update: {
          name: model.name,
          sourceName: defaultSourceName,
          sourceUrl: model.sourceUrl ?? make.sourceUrl,
        },
        create: {
          makeId: makeRecord.id,
          name: model.name,
          slug: slugify(model.name),
          sourceName: defaultSourceName,
          sourceUrl: model.sourceUrl ?? make.sourceUrl,
        },
      });
      recordsUpserted += 1;

      for (const generation of model.generations) {
        const generationRecord = await prisma.vehicleCatalogGeneration.upsert({
          where: {
            modelId_slug: {
              modelId: modelRecord.id,
              slug: slugify(generation.name),
            },
          },
          update: {
            name: generation.name,
            yearStart: generation.yearStart,
            yearEnd: generation.yearEnd,
            isCurrent: generation.isCurrent ?? false,
            sourceName: defaultSourceName,
            sourceUrl: generation.sourceUrl ?? model.sourceUrl ?? make.sourceUrl,
          },
          create: {
            modelId: modelRecord.id,
            name: generation.name,
            slug: slugify(generation.name),
            yearStart: generation.yearStart,
            yearEnd: generation.yearEnd,
            isCurrent: generation.isCurrent ?? false,
            sourceName: defaultSourceName,
            sourceUrl: generation.sourceUrl ?? model.sourceUrl ?? make.sourceUrl,
          },
        });
        recordsUpserted += 1;

        for (const variant of generation.variants) {
          const variantRecord = await prisma.vehicleCatalogVariant.upsert({
            where: {
              generationId_slug: {
                generationId: generationRecord.id,
                slug: slugify(variant.name),
              },
            },
            update: {
              name: variant.name,
              sourceName: defaultSourceName,
              sourceUrl: variant.sourceUrl ?? generation.sourceUrl ?? model.sourceUrl ?? make.sourceUrl,
            },
            create: {
              generationId: generationRecord.id,
              name: variant.name,
              slug: slugify(variant.name),
              sourceName: defaultSourceName,
              sourceUrl: variant.sourceUrl ?? generation.sourceUrl ?? model.sourceUrl ?? make.sourceUrl,
            },
          });
          recordsUpserted += 1;

          await prisma.vehicleCatalogVariantOffering.deleteMany({
            where: {
              variantId: variantRecord.id,
              sourceName: defaultSourceName,
            },
          });

          for (const offering of variant.offerings) {
            await prisma.vehicleCatalogVariantOffering.create({
              data: {
                variantId: variantRecord.id,
                fuelTypes: offering.fuelTypes,
                yearStart: offering.yearStart,
                yearEnd: offering.yearEnd,
                isCurrent: offering.isCurrent ?? false,
                sourceName: defaultSourceName,
                sourceUrl:
                  offering.sourceUrl ??
                  variant.sourceUrl ??
                  generation.sourceUrl ??
                  model.sourceUrl ??
                  make.sourceUrl,
              },
            });
            recordsUpserted += 1;
          }
        }
      }
    }
  }

  return recordsUpserted;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
