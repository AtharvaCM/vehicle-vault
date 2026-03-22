import type { Prisma, PrismaClient } from '@prisma/client';

import { indiaCatalogAliases } from './india-catalog-aliases';

type CatalogWriter = PrismaClient | Prisma.TransactionClient;

type CatalogTreeRecord = {
  aliases?: Array<{ alias: string }>;
  generations?: Array<CatalogGenerationTreeRecord>;
  id: string;
  marketCode?: string;
  models?: Array<CatalogModelTreeRecord>;
  name: string;
  vehicleType?: string;
};

type CatalogModelTreeRecord = {
  aliases: Array<{ alias: string }>;
  generations: Array<CatalogGenerationTreeRecord>;
  id: string;
  name: string;
};

type CatalogGenerationTreeRecord = {
  aliases: Array<{ alias: string }>;
  id: string;
  name: string;
  variants: Array<CatalogVariantTreeRecord>;
};

type CatalogVariantTreeRecord = {
  aliases: Array<{ alias: string }>;
  id: string;
  name: string;
};

export async function syncCatalogAliases(prisma: CatalogWriter) {
  const makes = await prisma.vehicleCatalogMake.findMany({
    include: {
      aliases: {
        select: {
          alias: true,
        },
      },
      models: {
        include: {
          aliases: {
            select: {
              alias: true,
            },
          },
          generations: {
            include: {
              aliases: {
                select: {
                  alias: true,
                },
              },
              variants: {
                include: {
                  aliases: {
                    select: {
                      alias: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const makeByKey = new Map<string, CatalogTreeRecord>();
  const modelByKey = new Map<string, CatalogModelTreeRecord>();
  const generationByKey = new Map<string, CatalogGenerationTreeRecord>();
  const variantByKey = new Map<string, CatalogVariantTreeRecord>();

  for (const make of makes) {
    const makeKey = buildMakeKey(make.marketCode, make.vehicleType, make.name);
    makeByKey.set(makeKey, make);

    for (const model of make.models) {
      const modelKey = buildModelKey(make.marketCode, make.vehicleType, make.name, model.name);
      modelByKey.set(modelKey, model);

      for (const generation of model.generations) {
        const generationKey = buildGenerationKey(
          make.marketCode,
          make.vehicleType,
          make.name,
          model.name,
          generation.name,
        );
        generationByKey.set(generationKey, generation);

        for (const variant of generation.variants) {
          variantByKey.set(
            buildVariantKey(
              make.marketCode,
              make.vehicleType,
              make.name,
              model.name,
              generation.name,
              variant.name,
            ),
            variant,
          );
        }
      }
    }
  }

  let syncedCount = 0;

  for (const seed of indiaCatalogAliases.makes) {
    const make = makeByKey.get(buildMakeKey(seed.marketCode, seed.vehicleType, seed.makeName));

    if (!make) {
      continue;
    }

    syncedCount += await upsertAliases(prisma, 'make', make.id, seed.aliases);
  }

  for (const seed of indiaCatalogAliases.models) {
    const model = modelByKey.get(
      buildModelKey(seed.marketCode, seed.vehicleType, seed.makeName, seed.modelName),
    );

    if (!model) {
      continue;
    }

    syncedCount += await upsertAliases(prisma, 'model', model.id, seed.aliases);
  }

  for (const seed of indiaCatalogAliases.generations) {
    const generation = generationByKey.get(
      buildGenerationKey(
        seed.marketCode,
        seed.vehicleType,
        seed.makeName,
        seed.modelName,
        seed.generationName,
      ),
    );

    if (!generation) {
      continue;
    }

    syncedCount += await upsertAliases(prisma, 'generation', generation.id, seed.aliases);
  }

  for (const seed of indiaCatalogAliases.variants) {
    const variant = variantByKey.get(
      buildVariantKey(
        seed.marketCode,
        seed.vehicleType,
        seed.makeName,
        seed.modelName,
        seed.generationName,
        seed.variantName,
      ),
    );

    if (!variant) {
      continue;
    }

    syncedCount += await upsertAliases(prisma, 'variant', variant.id, seed.aliases);
  }

  return syncedCount;
}

async function upsertAliases(
  prisma: CatalogWriter,
  scope: 'make' | 'model' | 'generation' | 'variant',
  parentId: string,
  aliases: string[],
) {
  let count = 0;

  for (const alias of aliases) {
    const normalizedAlias = normalizeAlias(alias);

    if (!normalizedAlias) {
      continue;
    }

    if (scope === 'make') {
      await prisma.vehicleCatalogMakeAlias.upsert({
        where: {
          makeId_normalizedAlias: {
            makeId: parentId,
            normalizedAlias,
          },
        },
        update: {
          alias,
        },
        create: {
          makeId: parentId,
          alias,
          normalizedAlias,
        },
      });
    } else if (scope === 'model') {
      await prisma.vehicleCatalogModelAlias.upsert({
        where: {
          modelId_normalizedAlias: {
            modelId: parentId,
            normalizedAlias,
          },
        },
        update: {
          alias,
        },
        create: {
          modelId: parentId,
          alias,
          normalizedAlias,
        },
      });
    } else if (scope === 'generation') {
      await prisma.vehicleCatalogGenerationAlias.upsert({
        where: {
          generationId_normalizedAlias: {
            generationId: parentId,
            normalizedAlias,
          },
        },
        update: {
          alias,
        },
        create: {
          generationId: parentId,
          alias,
          normalizedAlias,
        },
      });
    } else {
      await prisma.vehicleCatalogVariantAlias.upsert({
        where: {
          variantId_normalizedAlias: {
            variantId: parentId,
            normalizedAlias,
          },
        },
        update: {
          alias,
        },
        create: {
          variantId: parentId,
          alias,
          normalizedAlias,
        },
      });
    }

    count += 1;
  }

  return count;
}

function normalizeAlias(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function buildMakeKey(marketCode: string, vehicleType: string, makeName: string) {
  return [marketCode, vehicleType, normalizeAlias(makeName)].join('|');
}

function buildModelKey(
  marketCode: string,
  vehicleType: string,
  makeName: string,
  modelName: string,
) {
  return [buildMakeKey(marketCode, vehicleType, makeName), normalizeAlias(modelName)].join('|');
}

function buildGenerationKey(
  marketCode: string,
  vehicleType: string,
  makeName: string,
  modelName: string,
  generationName: string,
) {
  return [
    buildModelKey(marketCode, vehicleType, makeName, modelName),
    normalizeAlias(generationName),
  ].join('|');
}

function buildVariantKey(
  marketCode: string,
  vehicleType: string,
  makeName: string,
  modelName: string,
  generationName: string,
  variantName: string,
) {
  return [
    buildGenerationKey(marketCode, vehicleType, makeName, modelName, generationName),
    normalizeAlias(variantName),
  ].join('|');
}
