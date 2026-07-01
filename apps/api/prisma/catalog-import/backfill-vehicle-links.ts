/**
 * Backfill catalogVariantId on existing user vehicles. Uses the same matching
 * funnel as VehicleCatalogLinkerService — only links when exactly one
 * candidate variant remains, leaving ambiguous rows for the user to pick.
 *
 * Usage:
 *   pnpm --filter @vehicle-vault/api catalog:link-vehicles
 *   pnpm --filter @vehicle-vault/api catalog:link-vehicles -- --dry-run
 */
import { PrismaClient, FuelType, VehicleType } from '@prisma/client';

const prisma = new PrismaClient();

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');

type LinkInput = {
  make: string;
  model: string;
  year: number;
  vehicleType: VehicleType;
  fuelType: FuelType;
};

type LinkResult = { variantId: string | null; generationId: string | null };

async function resolveCatalogLink(input: LinkInput): Promise<LinkResult> {
  const empty: LinkResult = { variantId: null, generationId: null };
  const makeNorm = normalize(input.make);
  const modelNorm = normalize(input.model);
  if (!makeNorm || !modelNorm) return empty;

  const aliasMatches = await prisma.vehicleCatalogMakeAlias.findMany({
    where: { normalizedAlias: makeNorm },
    select: { makeId: true },
  });
  const directMatches = await prisma.vehicleCatalogMake.findMany({
    where: {
      OR: [
        { slug: makeNorm.replace(/ /g, '-') },
        { name: { equals: input.make, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  const candidateMakeIds = Array.from(
    new Set([...aliasMatches.map((a) => a.makeId), ...directMatches.map((m) => m.id)]),
  );

  if (candidateMakeIds.length === 0) return empty;

  const modelAlias = await prisma.vehicleCatalogModelAlias.findFirst({
    where: { normalizedAlias: modelNorm, model: { makeId: { in: candidateMakeIds } } },
    select: { modelId: true },
  });

  const modelId =
    modelAlias?.modelId ??
    (
      await prisma.vehicleCatalogModel.findFirst({
        where: {
          makeId: { in: candidateMakeIds },
          OR: [
            { slug: modelNorm.replace(/ /g, '-') },
            { name: { equals: input.model, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      })
    )?.id;

  if (!modelId) return empty;

  const generations = await prisma.vehicleCatalogGeneration.findMany({
    where: { modelId },
    select: { id: true, yearStart: true, yearEnd: true, isCurrent: true },
  });

  const inRange = generations.filter(
    (g) =>
      (g.yearStart == null || g.yearStart <= input.year) &&
      (g.yearEnd == null || g.yearEnd >= input.year),
  );

  const explicitRange = inRange.filter((g) => g.yearStart != null);

  let candidateGens: typeof generations;
  if (explicitRange.length > 0) {
    candidateGens = explicitRange;
  } else if (inRange.length > 0) {
    candidateGens = inRange;
  } else {
    const current = generations.filter((g) => g.isCurrent);
    if (current.length === 0) return empty;
    candidateGens = current;
  }

  const generationId =
    candidateGens.length === 1 && candidateGens[0] ? candidateGens[0].id : null;

  const variants = await prisma.vehicleCatalogVariant.findMany({
    where: {
      generationId: { in: candidateGens.map((g) => g.id) },
      offerings: { some: { fuelTypes: { has: input.fuelType } } },
    },
    select: { id: true, generationId: true },
  });

  if (variants.length === 1 && variants[0]) {
    return { variantId: variants[0].id, generationId: variants[0].generationId };
  }
  return { variantId: null, generationId };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const unmatched = await prisma.vehicle.findMany({
    where: { catalogVariantId: null },
    select: {
      id: true,
      make: true,
      model: true,
      year: true,
      vehicleType: true,
      fuelType: true,
    },
  });

  console.log(`Scanning ${unmatched.length} unmatched vehicles${dryRun ? ' (dry run)' : ''}`);

  let linkedVariant = 0;
  let linkedGenerationOnly = 0;
  for (const v of unmatched) {
    const { variantId, generationId } = await resolveCatalogLink({
      make: v.make,
      model: v.model,
      year: v.year,
      vehicleType: v.vehicleType,
      fuelType: v.fuelType,
    });
    if (!variantId && !generationId) {
      console.log(`  miss  ${v.vehicleType.padEnd(11)} ${v.make} ${v.model} ${v.year} (${v.fuelType})`);
      continue;
    }
    const tag = variantId ? 'VARIANT' : 'GEN    ';
    console.log(
      `  ${tag} ${v.vehicleType.padEnd(11)} ${v.make} ${v.model} ${v.year} (${v.fuelType}) -> variant=${variantId ?? '—'} generation=${generationId ?? '—'}`,
    );
    if (!dryRun) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: { catalogVariantId: variantId, catalogGenerationId: generationId },
      });
    }
    if (variantId) linkedVariant++;
    else linkedGenerationOnly++;
  }

  console.log(
    `\nLinked variant: ${linkedVariant}  Linked generation-only: ${linkedGenerationOnly}  Total: ${linkedVariant + linkedGenerationOnly}/${unmatched.length}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
