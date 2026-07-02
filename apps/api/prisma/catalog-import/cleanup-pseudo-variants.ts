/**
 * Remove CarWale pseudo-variants from the catalog.
 *
 * These rows are not trims. They come from model-page links such as city pages,
 * videos, range-detail pages, or "with <model>" detail links that look variant-
 * shaped in the source markup.
 *
 * Usage:
 *   pnpm catalog:cleanup-pseudo-variants -- --dry-run
 *   pnpm catalog:cleanup-pseudo-variants
 *   pnpm catalog:cleanup-pseudo-variants -- --verbose
 */
import { PrismaClient } from '@prisma/client';

import { isPseudoCatalogVariant } from './pseudo-variants';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  const variants = await prisma.vehicleCatalogVariant.findMany({
    include: {
      _count: { select: { vehicles: true } },
      generation: {
        select: {
          name: true,
          model: {
            select: {
              name: true,
              make: { select: { name: true, vehicleType: true } },
            },
          },
        },
      },
    },
    orderBy: [{ generation: { model: { make: { name: 'asc' } } } }, { name: 'asc' }],
  });

  const candidates = variants
    .filter((variant) => isPseudoCatalogVariant(variant.name))
    .map((variant) => ({
      id: variant.id,
      name: variant.name,
      make: variant.generation.model.make.name,
      model: variant.generation.model.name,
      generation: variant.generation.name,
      type: variant.generation.model.make.vehicleType,
      linkedVehicles: variant._count.vehicles,
    }));

  const blocked = candidates.filter((variant) => variant.linkedVehicles > 0);
  const deletable = candidates.filter((variant) => variant.linkedVehicles === 0);

  let deleted = 0;
  if (!dryRun) {
    for (const variant of deletable) {
      await prisma.vehicleCatalogVariant.delete({ where: { id: variant.id } });
      deleted++;
      if (verbose) {
        console.log(`Deleted ${variant.make} ${variant.model} ${variant.name}`);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        scannedVariants: variants.length,
        candidates: candidates.length,
        deletable: deletable.length,
        blockedByLinkedVehicles: blocked.length,
        deleted,
        dryRun,
        sample: candidates.slice(0, 30).map(({ id: _id, ...variant }) => variant),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
