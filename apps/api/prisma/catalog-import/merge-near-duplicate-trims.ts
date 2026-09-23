/**
 * Fold near-duplicate trims inside each catalog generation.
 *
 * CarWale names some trims its own way, so after the generation merge one
 * generation can list the same trim twice: "3XO AX5" beside "AX5", or Honda's
 * bare "V" beside CarWale's "V | Petrol | Manual" and "V | Petrol | Automatic".
 * The plan comes from `planTrimMerges`
 * (src/modules/vehicle-catalog/trim-merge-plan.ts); each pair is folded with
 * `foldVariant`, one transaction per generation, and the folded name stays as
 * an alias of the survivor so a re-import lands on it.
 *
 * Usage:
 *   pnpm catalog:merge-near-duplicate-trims -- --dry-run
 *   pnpm catalog:merge-near-duplicate-trims
 *   pnpm catalog:merge-near-duplicate-trims -- --verbose
 */
import { PrismaClient } from '@prisma/client';

import { planTrimMerges, type TrimFold } from '../../src/modules/vehicle-catalog/trim-merge-plan';
import { foldVariant } from './variant-fold';

type GenerationPlan = {
  generationId: string;
  label: string;
  folds: TrimFold[];
};

async function main() {
  const prisma = new PrismaClient();
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  try {
    const generations = await prisma.vehicleCatalogGeneration.findMany({
      include: {
        model: { select: { name: true, make: { select: { name: true } } } },
        variants: { select: { id: true, name: true } },
      },
      orderBy: [{ model: { make: { name: 'asc' } } }, { model: { name: 'asc' } }, { name: 'asc' }],
    });

    const plans: GenerationPlan[] = generations
      .map((generation) => ({
        generationId: generation.id,
        label: `${generation.model.make.name} ${generation.model.name} / ${generation.name}`,
        folds: planTrimMerges(generation.model.name, generation.variants),
      }))
      .filter((plan) => plan.folds.length > 0);

    const applied = { foldedVariants: 0, repointedVehicles: 0, droppedOfferings: 0 };

    if (!dryRun) {
      for (const plan of plans) {
        await prisma.$transaction(
          async (tx) => {
            for (const fold of plan.folds) {
              const result = await foldVariant(tx, {
                variantId: fold.variantId,
                intoVariantId: fold.intoVariantId,
                intoGenerationId: plan.generationId,
              });
              applied.foldedVariants += 1;
              applied.repointedVehicles += result.repointedVehicles;
              applied.droppedOfferings += result.droppedOfferings;
            }
          },
          { timeout: 60_000 },
        );
        if (verbose) console.log(`Folded ${plan.folds.length} in ${plan.label}`);
      }
    }

    const folds = plans.flatMap((plan) => plan.folds);
    console.log(
      JSON.stringify(
        {
          dryRun,
          scannedGenerations: generations.length,
          generationsWithNearDuplicates: plans.length,
          trimsToFold: folds.length,
          byReason: {
            modelPrefixed: folds.filter((fold) => fold.reason === 'model-prefixed').length,
            parentOfDetailed: folds.filter((fold) => fold.reason === 'parent-of-detailed').length,
          },
          applied: dryRun ? null : applied,
          plans: (verbose ? plans : plans.slice(0, 10)).map((plan) => ({
            generation: plan.label,
            folds: plan.folds.map((fold) => `${fold.variantName} → ${fold.intoVariantName}`),
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
