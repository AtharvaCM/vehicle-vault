/**
 * Merge duplicate "current" generations of a catalog model into one.
 *
 * An official-site snapshot, the CarWale scrape and the curated seed each gave
 * the same car its own current generation ("Amaze (2024 refresh)", "Amaze
 * (current)", "Amaze lineup"). The plan for each model comes from
 * `planGenerationMerge` (src/modules/vehicle-catalog/generation-merge-plan.ts);
 * this script loads the rows and applies it, one transaction per model:
 *
 * - variants new to the absorbing generation move into it;
 * - a variant whose slug the model already has folds into that variant: its
 *   offerings (unless the survivor already has that fuel mix), the richer spec
 *   row, its aliases, its service intervals and its linked vehicles move over,
 *   and it is deleted;
 * - vehicles linked to an absorbed generation are re-pointed;
 * - each absorbed generation is deleted, its name and aliases kept as aliases
 *   of the absorbing one, so a re-import lands there (see generation-redirects).
 *
 * Usage:
 *   pnpm catalog:merge-duplicate-generations -- --dry-run
 *   pnpm catalog:merge-duplicate-generations
 *   pnpm catalog:merge-duplicate-generations -- --verbose
 */
import { PrismaClient, type Prisma } from '@prisma/client';

import {
  planGenerationMerge,
  type GenerationMergePlan,
  type GenerationMergeSkip,
} from '../../src/modules/vehicle-catalog/generation-merge-plan';
import { pathVehicleTypes } from './generation-redirects';
import { normalizeAlias } from './sync-catalog-aliases';
import { foldVariant } from './variant-fold';

type Tx = Prisma.TransactionClient;

type MergeCounts = {
  movedVariants: number;
  foldedVariants: number;
  deletedGenerations: number;
  deletedModels: number;
  repointedVehicles: number;
  droppedOfferings: number;
};

async function main() {
  const prisma = new PrismaClient();
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  try {
    const models = await prisma.vehicleCatalogModel.findMany({
      where: { generations: { some: { isCurrent: true } } },
      include: {
        make: { select: { name: true, slug: true, marketCode: true, vehicleType: true } },
        generations: {
          include: { variants: { select: { id: true, name: true, slug: true } } },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ make: { name: 'asc' } }, { name: 'asc' }],
    });

    // One address, one plan: model rows sharing a make and model slug across
    // the make rows of a segment are merged as one.
    const groups = new Map<string, typeof models>();
    for (const model of models) {
      const key = [
        model.make.marketCode,
        pathVehicleTypes(model.make.vehicleType).join('+'),
        model.make.slug,
        model.slug,
      ].join('|');
      groups.set(key, [...(groups.get(key) ?? []), model]);
    }

    const plans: GenerationMergePlan[] = [];
    const skipped: GenerationMergeSkip[] = [];

    for (const [key, rows] of groups) {
      const decision = planGenerationMerge({
        id: key,
        label: `${rows[0]!.make.name} ${rows[0]!.name} (${rows.map((row) => row.make.vehicleType).join('/')})`,
        modelIds: rows.map((row) => row.id),
        generations: rows.flatMap((row) => row.generations),
      });
      if (decision?.kind === 'merge') plans.push(decision);
      if (decision?.kind === 'skip') skipped.push(decision);
    }

    const totals: MergeCounts = {
      movedVariants: 0,
      foldedVariants: 0,
      deletedGenerations: 0,
      deletedModels: 0,
      repointedVehicles: 0,
      droppedOfferings: 0,
    };

    if (!dryRun) {
      for (const plan of plans) {
        const counts = await prisma.$transaction((tx) => applyPlan(tx, plan), { timeout: 60_000 });
        for (const key of Object.keys(totals) as Array<keyof MergeCounts>) {
          totals[key] += counts[key];
        }
        if (verbose) console.log(`Merged ${plan.label}: ${JSON.stringify(counts)}`);
      }
    }

    const describe = (plan: GenerationMergePlan) => ({
      model: plan.label,
      into: plan.into.name,
      absorbed: plan.absorbed.map((generation) => generation.name),
      moves: plan.moves.length,
      folds: plan.folds.length,
    });

    console.log(
      JSON.stringify(
        {
          dryRun,
          scannedModels: models.length,
          modelsToMerge: plans.length,
          generationsToAbsorb: plans.reduce((sum, plan) => sum + plan.absorbed.length, 0),
          variantsToMove: plans.reduce((sum, plan) => sum + plan.moves.length, 0),
          variantsToFold: plans.reduce((sum, plan) => sum + plan.folds.length, 0),
          applied: dryRun ? null : totals,
          skipped: skipped.map(({ label, reason, generations }) => ({
            label,
            reason,
            generations,
          })),
          plans: verbose ? plans.map(describe) : plans.slice(0, 10).map(describe),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function applyPlan(tx: Tx, plan: GenerationMergePlan): Promise<MergeCounts> {
  const counts: MergeCounts = {
    movedVariants: 0,
    foldedVariants: 0,
    deletedGenerations: 0,
    deletedModels: 0,
    repointedVehicles: 0,
    droppedOfferings: 0,
  };

  for (const fold of plan.folds) {
    const result = await foldVariant(tx, fold);
    counts.foldedVariants += 1;
    counts.repointedVehicles += result.repointedVehicles;
    counts.droppedOfferings += result.droppedOfferings;
  }

  for (const move of plan.moves) {
    await tx.vehicleCatalogVariant.update({
      where: { id: move.variantId },
      data: { generationId: move.toGenerationId },
    });
    const vehicles = await tx.vehicle.updateMany({
      where: { catalogVariantId: move.variantId },
      data: { catalogGenerationId: move.toGenerationId },
    });
    counts.movedVariants += 1;
    counts.repointedVehicles += vehicles.count;
  }

  for (const generation of plan.absorbed) {
    const vehicles = await tx.vehicle.updateMany({
      where: { catalogGenerationId: generation.id },
      data: { catalogGenerationId: plan.into.id },
    });
    counts.repointedVehicles += vehicles.count;

    const aliases = await tx.vehicleCatalogGenerationAlias.findMany({
      where: { generationId: generation.id },
      select: { alias: true },
    });
    for (const alias of [generation.name, ...aliases.map((row) => row.alias)]) {
      const normalizedAlias = normalizeAlias(alias);
      if (!normalizedAlias) continue;
      await tx.vehicleCatalogGenerationAlias.upsert({
        where: { generationId_normalizedAlias: { generationId: plan.into.id, normalizedAlias } },
        update: {},
        create: { generationId: plan.into.id, alias, normalizedAlias },
      });
    }

    const left = await tx.vehicleCatalogVariant.count({ where: { generationId: generation.id } });
    if (left > 0) {
      throw new Error(
        `${plan.label}: ${generation.name} still has ${left} variants; not deleting.`,
      );
    }
    await tx.vehicleCatalogGeneration.delete({ where: { id: generation.id } });
    counts.deletedGenerations += 1;
  }

  // A model row the merge emptied (Honda's car-type Elevate, once its trims
  // moved to the SUV row) would only be an empty duplicate in the pickers. Its
  // name stays reachable: an import redirects its generations by address.
  for (const modelId of plan.modelIds) {
    const generations = await tx.vehicleCatalogGeneration.count({ where: { modelId } });
    if (generations === 0) {
      await tx.vehicleCatalogModel.delete({ where: { id: modelId } });
      counts.deletedModels += 1;
    }
  }

  return counts;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
