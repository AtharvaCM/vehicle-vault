import type { Prisma, PrismaClient } from '@prisma/client';

import { slugify } from './catalog-slug';
import { findGenerationRedirect, type GenerationRedirect } from './generation-redirects';
import { isPseudoCatalogVariant } from './pseudo-variants';
import type { CatalogDataset } from './types';

export { slugify };

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
      // A generation merged into another one keeps landing there, under the
      // absorbing generation's own name and years, possibly in another make
      // row of the same address; see generation-redirects.
      const redirects = new Map<string, GenerationRedirect>();
      for (const generation of model.generations) {
        const redirect = await findGenerationRedirect(prisma, {
          marketCode: make.marketCode,
          vehicleType: make.vehicleType,
          makeName: make.name,
          modelName: model.name,
          generationName: generation.name,
        });
        if (redirect) redirects.set(generation.name, redirect);
      }

      // A model whose every generation now lives in another make row's model is
      // not recreated here as an empty duplicate.
      const modelRecord =
        model.generations.length > 0 && redirects.size === model.generations.length
          ? null
          : await prisma.vehicleCatalogModel.upsert({
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
      if (modelRecord) recordsUpserted += 1;

      for (const generation of model.generations) {
        const redirect = redirects.get(generation.name);
        const generationRecord = redirect
          ? { id: redirect.generationId }
          : await prisma.vehicleCatalogGeneration.upsert({
              where: {
                modelId_slug: {
                  modelId: modelRecord!.id,
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
                modelId: modelRecord!.id,
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
          if (isPseudoCatalogVariant(variant.name)) continue;

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
              sourceUrl:
                variant.sourceUrl ?? generation.sourceUrl ?? model.sourceUrl ?? make.sourceUrl,
            },
            create: {
              generationId: generationRecord.id,
              name: variant.name,
              slug: slugify(variant.name),
              sourceName: defaultSourceName,
              sourceUrl:
                variant.sourceUrl ?? generation.sourceUrl ?? model.sourceUrl ?? make.sourceUrl,
            },
          });
          recordsUpserted += 1;

          const offeringOverrides = await prisma.vehicleCatalogVariantOfferingOverride.findMany({
            where: {
              variantId: variantRecord.id,
              sourceName: defaultSourceName,
            },
          });
          const overridesBySignature = new Map(
            offeringOverrides.map((override) => [override.fuelTypeSignature, override]),
          );

          await prisma.vehicleCatalogVariantOffering.deleteMany({
            where: {
              variantId: variantRecord.id,
              sourceName: defaultSourceName,
            },
          });

          for (const offering of variant.offerings) {
            const override = overridesBySignature.get(buildFuelTypeSignature(offering.fuelTypes));

            await prisma.vehicleCatalogVariantOffering.create({
              data: {
                variantId: variantRecord.id,
                fuelTypes: offering.fuelTypes,
                yearStart: override ? override.manualYearStart : offering.yearStart,
                yearEnd: override ? override.manualYearEnd : offering.yearEnd,
                isCurrent: override
                  ? (override.manualIsCurrent ?? false)
                  : (offering.isCurrent ?? false),
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

function buildFuelTypeSignature(fuelTypes: readonly string[]) {
  return [...fuelTypes].sort().join('|');
}
