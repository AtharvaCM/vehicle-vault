import type { Prisma } from '@prisma/client';

import { normalizeAlias } from './sync-catalog-aliases';

type Tx = Prisma.TransactionClient;

/** One variant folding into another that describes the same trim. */
export type VariantFold = {
  variantId: string;
  intoVariantId: string;
  /** The survivor's generation, for vehicles re-pointed onto it. */
  intoGenerationId: string;
};

/**
 * Fold one catalog variant into another that describes the same trim, then
 * delete it. Shared by `catalog:merge-duplicate-generations` and
 * `catalog:merge-near-duplicate-trims`:
 *
 * - offerings move, unless the survivor already has one for that fuel mix;
 * - the richer spec row is kept;
 * - its name and aliases become aliases of the survivor, so an import that
 *   still uses the old name lands on the survivor (see generation-redirects);
 * - service intervals move where the survivor has none for that category;
 * - linked vehicles are re-pointed.
 */
export async function foldVariant(tx: Tx, fold: VariantFold) {
  const { variantId: from, intoVariantId: into } = fold;
  let droppedOfferings = 0;

  // Offerings: the survivor's own figures win for a fuel mix it already has.
  const intoOfferings = await tx.vehicleCatalogVariantOffering.findMany({
    where: { variantId: into },
    select: { fuelTypes: true },
  });
  const intoSignatures = new Set(intoOfferings.map((row) => fuelSignature(row.fuelTypes)));
  const fromOfferings = await tx.vehicleCatalogVariantOffering.findMany({
    where: { variantId: from },
    select: { id: true, fuelTypes: true },
  });
  for (const offering of fromOfferings) {
    if (intoSignatures.has(fuelSignature(offering.fuelTypes))) {
      await tx.vehicleCatalogVariantOffering.delete({ where: { id: offering.id } });
      droppedOfferings += 1;
    } else {
      await tx.vehicleCatalogVariantOffering.update({
        where: { id: offering.id },
        data: { variantId: into },
      });
    }
  }

  const overrides = await tx.vehicleCatalogVariantOfferingOverride.findMany({
    where: { variantId: from },
  });
  for (const override of overrides) {
    const clash = await tx.vehicleCatalogVariantOfferingOverride.findUnique({
      where: {
        variantId_sourceName_fuelTypeSignature: {
          variantId: into,
          sourceName: override.sourceName,
          fuelTypeSignature: override.fuelTypeSignature,
        },
      },
    });
    if (clash) {
      await tx.vehicleCatalogVariantOfferingOverride.delete({ where: { id: override.id } });
    } else {
      await tx.vehicleCatalogVariantOfferingOverride.update({
        where: { id: override.id },
        data: { variantId: into },
      });
    }
  }

  // Specs: keep whichever row knows more.
  const [fromSpec, intoSpec] = await Promise.all([
    tx.vehicleCatalogVariantSpec.findUnique({ where: { variantId: from } }),
    tx.vehicleCatalogVariantSpec.findUnique({ where: { variantId: into } }),
  ]);
  if (fromSpec && (!intoSpec || filledFields(fromSpec) > filledFields(intoSpec))) {
    if (intoSpec) await tx.vehicleCatalogVariantSpec.delete({ where: { id: intoSpec.id } });
    await tx.vehicleCatalogVariantSpec.update({
      where: { id: fromSpec.id },
      data: { variantId: into },
    });
  }

  const [fromVariant, aliases] = await Promise.all([
    tx.vehicleCatalogVariant.findUniqueOrThrow({ where: { id: from }, select: { name: true } }),
    tx.vehicleCatalogVariantAlias.findMany({ where: { variantId: from }, select: { alias: true } }),
  ]);
  for (const alias of [fromVariant.name, ...aliases.map((row) => row.alias)]) {
    const normalizedAlias = normalizeAlias(alias);
    if (!normalizedAlias) continue;
    await tx.vehicleCatalogVariantAlias.upsert({
      where: { variantId_normalizedAlias: { variantId: into, normalizedAlias } },
      update: {},
      create: { variantId: into, alias, normalizedAlias },
    });
  }

  const intervals = await tx.serviceInterval.findMany({ where: { variantId: from } });
  for (const interval of intervals) {
    const clash = await tx.serviceInterval.findUnique({
      where: { variantId_category: { variantId: into, category: interval.category } },
    });
    if (clash) {
      await tx.serviceInterval.delete({ where: { id: interval.id } });
    } else {
      await tx.serviceInterval.update({ where: { id: interval.id }, data: { variantId: into } });
    }
  }

  const vehicles = await tx.vehicle.updateMany({
    where: { catalogVariantId: from },
    data: { catalogVariantId: into, catalogGenerationId: fold.intoGenerationId },
  });

  // Cascades take the variant's own leftovers: a poorer spec row and its aliases.
  await tx.vehicleCatalogVariant.delete({ where: { id: from } });

  return { repointedVehicles: vehicles.count, droppedOfferings };
}

function fuelSignature(fuelTypes: readonly string[]) {
  return [...fuelTypes].sort().join('|');
}

function filledFields(spec: Record<string, unknown>) {
  const skip = new Set(['id', 'variantId', 'sourceName', 'createdAt', 'updatedAt']);
  return Object.entries(spec).filter(
    ([key, value]) => !skip.has(key) && value !== null && value !== '',
  ).length;
}
