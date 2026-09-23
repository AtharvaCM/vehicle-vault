/**
 * Drop the model name CarWale repeats at the start of a trim's name: "Liva GX"
 * in the Toyota Etios Liva becomes "GX", "7 Premium" in the BYD eMax 7 becomes
 * "Premium". The plan comes from `planTrimRenames`
 * (src/modules/vehicle-catalog/trim-merge-plan.ts). Each trim keeps its old name
 * as a variant alias, so a re-import that still uses it lands on the renamed
 * trim (see generation-redirects), and one transaction per generation renames
 * it and re-keys its slug.
 *
 * Run `catalog:merge-near-duplicate-trims` first: a trim whose shortened name
 * already exists is a duplicate to fold, and is left alone here.
 *
 * Usage:
 *   pnpm catalog:strip-model-name-from-trims -- --dry-run
 *   pnpm catalog:strip-model-name-from-trims
 *   pnpm catalog:strip-model-name-from-trims -- --verbose
 */
import { PrismaClient } from '@prisma/client';

import {
  planTrimRenames,
  type TrimRename,
} from '../../src/modules/vehicle-catalog/trim-merge-plan';
import { slugify } from './catalog-slug';
import { normalizeAlias } from './sync-catalog-aliases';

type GenerationPlan = { generationId: string; label: string; renames: TrimRename[] };

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
        renames: planTrimRenames(generation.model.name, generation.variants),
      }))
      .filter((plan) => plan.renames.length > 0);

    let renamed = 0;
    if (!dryRun) {
      for (const plan of plans) {
        await prisma.$transaction(async (tx) => {
          for (const rename of plan.renames) {
            const slug = slugify(rename.to);
            const clash = await tx.vehicleCatalogVariant.findFirst({
              where: { generationId: plan.generationId, slug, NOT: { id: rename.variantId } },
              select: { id: true },
            });
            if (clash) continue;

            await tx.vehicleCatalogVariant.update({
              where: { id: rename.variantId },
              data: { name: rename.to, slug },
            });
            const normalizedAlias = normalizeAlias(rename.from);
            if (normalizedAlias) {
              await tx.vehicleCatalogVariantAlias.upsert({
                where: {
                  variantId_normalizedAlias: { variantId: rename.variantId, normalizedAlias },
                },
                update: {},
                create: { variantId: rename.variantId, alias: rename.from, normalizedAlias },
              });
            }
            renamed += 1;
          }
        });
        if (verbose) console.log(`Renamed ${plan.renames.length} in ${plan.label}`);
      }
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          scannedGenerations: generations.length,
          generationsToTidy: plans.length,
          trimsToRename: plans.reduce((sum, plan) => sum + plan.renames.length, 0),
          renamed: dryRun ? null : renamed,
          plans: (verbose ? plans : plans.slice(0, 10)).map((plan) => ({
            generation: plan.label,
            renames: plan.renames.map((rename) => `${rename.from} → ${rename.to}`),
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
