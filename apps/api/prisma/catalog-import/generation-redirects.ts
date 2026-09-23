import type { Prisma, PrismaClient, VehicleType } from '@prisma/client';

import { slugify } from './catalog-slug';
import { normalizeAlias } from './sync-catalog-aliases';

type CatalogReader = PrismaClient | Prisma.TransactionClient;

/** Where a source files a generation: its make row, its model and the generation's own name. */
export type GenerationPath = {
  marketCode: string;
  vehicleType: string;
  makeName: string;
  modelName: string;
  generationName: string;
};

export type GenerationRedirect = {
  generationId: string;
  name: string;
  modelId: string;
  modelName: string;
  makeName: string;
  vehicleType: VehicleType;
};

/**
 * Body types one public catalog address spans: cars, SUVs and vans all live
 * under `/cars` (`PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES` in the shared package).
 * Spelled out here because the catalog scripts run before the shared package is
 * built (CI seeds the database first), so they cannot import it at runtime.
 */
const CARS_SEGMENT_TYPES: VehicleType[] = ['car', 'suv', 'van'];

/**
 * The make rows one catalog address spans. Sources disagree on body type (the
 * CarWale scrape files the Honda Elevate as a car, Honda's own site as an SUV),
 * and a public page groups cars, SUVs and vans under `/cars`, so a merge can
 * cross those make rows. Any other type stays on its own.
 */
export function pathVehicleTypes(vehicleType: string): VehicleType[] {
  return (CARS_SEGMENT_TYPES as string[]).includes(vehicleType)
    ? CARS_SEGMENT_TYPES
    : [vehicleType as VehicleType];
}

/**
 * Where a source's generation lands when the catalog has merged it into another
 * one (see `catalog:merge-duplicate-generations`).
 *
 * A merged-away generation is deleted and its name kept as an alias of the
 * generation that absorbed it, possibly under another make row of the same
 * address. A source that still calls it by the old name ("Amaze (current)") is
 * redirected there, so re-importing never recreates the duplicate. The exact
 * slug wins: while the source's own make row has a generation of that name, it
 * is used as it is, and an alias is only a fallback.
 */
export async function findGenerationRedirect(
  prisma: CatalogReader,
  path: GenerationPath,
): Promise<GenerationRedirect | null> {
  const makeSlug = slugify(path.makeName);
  const modelSlug = slugify(path.modelName);

  const exact = await prisma.vehicleCatalogGeneration.findFirst({
    where: {
      slug: slugify(path.generationName),
      model: {
        slug: modelSlug,
        make: {
          slug: makeSlug,
          marketCode: path.marketCode,
          vehicleType: path.vehicleType as VehicleType,
        },
      },
    },
    select: { id: true },
  });
  if (exact) return null;

  const normalizedAlias = normalizeAlias(path.generationName);
  if (!normalizedAlias) return null;

  const alias = await prisma.vehicleCatalogGenerationAlias.findFirst({
    where: {
      normalizedAlias,
      generation: {
        model: {
          slug: modelSlug,
          make: {
            slug: makeSlug,
            marketCode: path.marketCode,
            vehicleType: { in: pathVehicleTypes(path.vehicleType) },
          },
        },
      },
    },
    select: {
      generation: {
        select: {
          id: true,
          name: true,
          model: {
            select: { id: true, name: true, make: { select: { name: true, vehicleType: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!alias) return null;

  const { generation } = alias;
  return {
    generationId: generation.id,
    name: generation.name,
    modelId: generation.model.id,
    modelName: generation.model.name,
    makeName: generation.model.make.name,
    vehicleType: generation.model.make.vehicleType,
  };
}

type DatasetGeneration = { name: string };
type DatasetModel = { name: string; generations: ReadonlyArray<DatasetGeneration> };
type DatasetMake = {
  marketCode: string;
  vehicleType: string;
  name: string;
  models: ReadonlyArray<DatasetModel>;
};

/**
 * The dataset with each merged-away generation filed where the catalog now
 * keeps it: renamed to the generation that absorbed it, and moved under that
 * generation's make row and model when those differ. The import review keys
 * variants by make row, model and generation, so without this a re-import would
 * list every merged variant as missing, and archive-missing would end offerings
 * that are still on sale.
 */
export async function canonicalizeGenerationNames<T extends ReadonlyArray<DatasetMake>>(
  prisma: CatalogReader,
  dataset: T,
): Promise<T> {
  type ModelOut = Omit<DatasetModel, 'generations'> & { generations: DatasetGeneration[] };
  type MakeOut = Omit<DatasetMake, 'models'> & { models: ModelOut[] };
  const makes = new Map<string, MakeOut>();

  const makeFor = (template: DatasetMake, vehicleType: string, name: string): MakeOut => {
    const key = `${template.marketCode}|${vehicleType}|${slugify(name)}`;
    let make = makes.get(key);
    if (!make) {
      make =
        vehicleType === template.vehicleType && name === template.name
          ? { ...template, models: [] as ModelOut[] }
          : { marketCode: template.marketCode, vehicleType, name, models: [] as ModelOut[] };
      makes.set(key, make);
    }
    return make;
  };
  const modelFor = (make: MakeOut, template: DatasetModel, name: string): ModelOut => {
    let model = make.models.find((candidate) => slugify(candidate.name) === slugify(name));
    if (!model) {
      model =
        name === template.name
          ? { ...template, generations: [] as DatasetGeneration[] }
          : { name, generations: [] as DatasetGeneration[] };
      make.models.push(model);
    }
    return model;
  };

  for (const make of dataset) {
    // Keep the source's own make row in its place, even when all of it moves away.
    makeFor(make, make.vehicleType, make.name);

    for (const model of make.models) {
      for (const generation of model.generations) {
        const redirect = await findGenerationRedirect(prisma, {
          marketCode: make.marketCode,
          vehicleType: make.vehicleType,
          makeName: make.name,
          modelName: model.name,
          generationName: generation.name,
        });

        const targetMake = redirect
          ? makeFor(make, redirect.vehicleType, redirect.makeName)
          : makeFor(make, make.vehicleType, make.name);
        const targetModel = modelFor(targetMake, model, redirect?.modelName ?? model.name);
        targetModel.generations.push(
          redirect ? { ...generation, name: redirect.name } : generation,
        );
      }
    }
  }

  return [...makes.values()]
    .map((make) => ({
      ...make,
      models: make.models.filter((model) => model.generations.length > 0),
    }))
    .filter((make) => make.models.length > 0) as unknown as T;
}
