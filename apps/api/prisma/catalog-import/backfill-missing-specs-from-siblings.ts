/**
 * Backfill missing variant specs from nearby catalog siblings.
 *
 * This is intended for trim-level gaps after source scraping: variants in the
 * same generation commonly share engine, dimensions, wheels, safety equipment,
 * and battery data. When a whole generation has no specs, another generation of
 * the same model is a useful baseline. The script prefers siblings with
 * overlapping fuel types, then falls back to any sibling in the selected group.
 *
 * Usage:
 *   pnpm catalog:backfill-specs
 *   pnpm catalog:backfill-specs -- --dry-run
 *   pnpm catalog:backfill-specs -- --dry-run --verbose
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SPEC_COPY_KEYS = [
  'engineCc',
  'engineCyl',
  'engineType',
  'engineFuel',
  'powerPs',
  'powerRpm',
  'torqueNm',
  'torqueRpm',
  'transmission',
  'driveType',
  'lengthMm',
  'widthMm',
  'heightMm',
  'wheelbaseMm',
  'kerbWeightKg',
  'grossWeightKg',
  'bootSpaceLitres',
  'groundClearanceMm',
  'turningRadiusM',
  'topSpeedKph',
  'mileageCity',
  'mileageHighway',
  'mileageCombined',
  'fuelCapLitres',
  'seatingCapacity',
  'bodyType',
  'doors',
  'tyreSize',
  'wheelType',
  'wheelSizeInch',
  'airbagCount',
  'safetyFeatures',
  'ncapStarsAdult',
  'ncapStarsChild',
  'ncapRegion',
  'hasAbs',
  'hasEsc',
  'hasTpms',
  'hasHillHoldAssist',
  'isofixPoints',
  'adasFeatures',
  'batteryKwh',
  'rangeKm',
  'motorKw',
  'acChargeKw',
  'dcFastChargeKw',
  'chargeTime0To80Min',
  'batteryChemistry',
  'gearCount',
  'coolingType',
  'frameType',
  'seatHeightMm',
  'brakeFrontType',
  'brakeRearType',
  'absChannels',
  'payloadKg',
  'gvwKg',
  'cargoVolumeL',
  'towingCapacityKg',
  'axleConfig',
] as const;

function fuelTypes(variant: { offerings: Array<{ fuelTypes: string[] }> }): Set<string> {
  return new Set(variant.offerings.flatMap((offering) => offering.fuelTypes));
}

function hasFuelOverlap(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function copySpecData(spec: Record<string, unknown>, sourceName: string) {
  const data: Record<string, unknown> = {};
  for (const key of SPEC_COPY_KEYS) {
    if (spec[key] !== undefined) data[key] = spec[key];
  }
  data.sourceName = sourceName;
  return data;
}

function bestCandidate<T extends { offerings: Array<{ fuelTypes: string[] }>; spec: unknown }>(
  target: { offerings: Array<{ fuelTypes: string[] }> },
  candidates: T[],
): T | undefined {
  const targetFuelTypes = fuelTypes(target);
  return (
    candidates.find((sibling) => hasFuelOverlap(targetFuelTypes, fuelTypes(sibling))) ??
    candidates[0]
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');
  const variants = await prisma.vehicleCatalogVariant.findMany({
    include: {
      offerings: { select: { fuelTypes: true } },
      spec: true,
      generation: {
        select: {
          name: true,
          model: {
            select: {
              id: true,
              name: true,
              make: { select: { name: true, vehicleType: true } },
            },
          },
        },
      },
    },
    orderBy: [{ generationId: 'asc' }, { name: 'asc' }],
  });

  const byGeneration = new Map<string, typeof variants>();
  const byModel = new Map<string, typeof variants>();
  for (const variant of variants) {
    const generationVariants = byGeneration.get(variant.generationId) ?? [];
    generationVariants.push(variant);
    byGeneration.set(variant.generationId, generationVariants);

    const modelVariants = byModel.get(variant.generation.model.id) ?? [];
    modelVariants.push(variant);
    byModel.set(variant.generation.model.id, modelVariants);
  }

  let scanned = 0;
  let fillable = 0;
  let created = 0;
  let generationSibling = 0;
  let modelSibling = 0;
  let noSiblingSpec = 0;

  for (const variant of variants) {
    if (variant.spec) continue;
    scanned++;

    const generationSiblings = (byGeneration.get(variant.generationId) ?? []).filter(
      (candidate) => candidate.id !== variant.id && candidate.spec,
    );

    let sourceName = 'sibling-baseline:generation';
    let candidate = bestCandidate(variant, generationSiblings);
    if (candidate) {
      generationSibling++;
    } else {
      const modelSiblings = (byModel.get(variant.generation.model.id) ?? []).filter(
        (sibling) => sibling.id !== variant.id && sibling.spec,
      );
      candidate = bestCandidate(variant, modelSiblings);
      if (candidate) {
        modelSibling++;
        sourceName = 'sibling-baseline:model';
      }
    }

    if (!candidate?.spec) {
      noSiblingSpec++;
      continue;
    }

    fillable++;
    const label = `${variant.generation.model.make.name} ${variant.generation.model.name} ${variant.name}`;
    if (dryRun) {
      if (verbose) console.log(`  [DRY] ${label} <- ${candidate.name}`);
      continue;
    }

    await prisma.vehicleCatalogVariantSpec.create({
      data: {
        variantId: variant.id,
        ...copySpecData(candidate.spec as unknown as Record<string, unknown>, sourceName),
      },
    });
    if (verbose) console.log(`  ${label} <- ${candidate.name}`);
    created++;
  }

  console.log(
    JSON.stringify(
      {
        scannedMissing: scanned,
        fillableFromCatalogSibling: fillable,
        generationSibling,
        modelSibling,
        created,
        noCatalogSiblingSpec: noSiblingSpec,
        dryRun,
        verbose,
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
