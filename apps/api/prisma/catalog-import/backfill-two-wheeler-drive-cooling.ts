/**
 * Fill two-wheeler final drive and cooling from the curated table (#235),
 * wherever the spec source left them empty.
 *
 * Chain service shows only when a motorcycle's spec says chain drive, and
 * coolant only when it says liquid-cooled. The bike spec scraper fills both
 * where BikeWale publishes them (`pnpm catalog:scrape-bike-specs --
 * --fill-drive-cooling`); this covers the rest from
 * `src/modules/vehicle-catalog/two-wheeler-drive-cooling.ts`. It only fills
 * empty fields, so the source's own values win and a rerun changes nothing; a
 * variant with no spec row gets one holding just these two fields.
 *
 * Usage:
 *   pnpm catalog:backfill-two-wheeler-drive-cooling -- --dry-run
 *   pnpm catalog:backfill-two-wheeler-drive-cooling
 */
import { PrismaClient } from '@prisma/client';

import {
  curatedDriveCooling,
  missingDriveCooling,
} from '../../src/modules/vehicle-catalog/two-wheeler-drive-cooling';

const SOURCE_NAME = 'curated-two-wheeler';

async function main() {
  const prisma = new PrismaClient();
  const dryRun = process.argv.includes('--dry-run');
  const counts = { variants: 0, filled: 0, created: 0, unchanged: 0 };

  try {
    const variants = await prisma.vehicleCatalogVariant.findMany({
      where: { generation: { model: { make: { vehicleType: 'motorcycle' } } } },
      include: {
        spec: true,
        generation: {
          select: { model: { select: { name: true, make: { select: { name: true } } } } },
        },
      },
      orderBy: { id: 'asc' },
    });

    for (const variant of variants) {
      counts.variants += 1;
      const { model } = variant.generation;
      const curated = curatedDriveCooling({
        make: model.make.name,
        model: model.name,
        bodyType: variant.spec?.bodyType ?? null,
        transmission: variant.spec?.transmission ?? null,
      });
      const fill = missingDriveCooling(variant.spec, curated);
      if (Object.keys(fill).length === 0) {
        counts.unchanged += 1;
        continue;
      }

      const label = `${model.make.name} ${model.name} ${variant.name}`;
      console.log(`${dryRun ? '[dry] ' : ''}${label}: ${JSON.stringify(fill)}`);
      if (dryRun) continue;

      if (variant.spec) {
        await prisma.vehicleCatalogVariantSpec.update({
          where: { id: variant.spec.id },
          data: fill,
        });
        counts.filled += 1;
      } else {
        await prisma.vehicleCatalogVariantSpec.create({
          data: { variantId: variant.id, ...fill, sourceName: SOURCE_NAME },
        });
        counts.created += 1;
      }
    }

    console.log(
      `\n${counts.variants} two-wheeler variants: ${counts.filled} filled, ${counts.created} spec rows created, ${counts.unchanged} already complete${dryRun ? ' (dry run: nothing written)' : ''}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
