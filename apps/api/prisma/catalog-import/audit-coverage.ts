/**
 * Catalog coverage audit.
 *
 * Reports:
 *   - Catalog size per market × vehicleType (makes, models, generations, variants).
 *   - Spec coverage: variants WITH vs WITHOUT VehicleCatalogVariantSpec.
 *   - Offering coverage: variants WITHOUT any VehicleCatalogVariantOffering.
 *   - User-owned vehicles unmatched to catalogVariantId.
 *   - Top unmatched (make, model, year) clusters — drives next ingest priority.
 *
 * Usage:
 *   pnpm --filter @vehicle-vault/api exec ts-node \
 *     --project apps/api/tsconfig.json --transpile-only \
 *     apps/api/prisma/catalog-import/audit-coverage.ts
 *
 *   Optional: --market=IN --json
 */
import { PrismaClient, VehicleType } from '@prisma/client';

const prisma = new PrismaClient();

type Args = { market?: string; json: boolean };

function parseArgs(): Args {
  const args: Args = { json: false };
  for (const raw of process.argv.slice(2)) {
    if (raw === '--json') args.json = true;
    else if (raw.startsWith('--market=')) args.market = raw.split('=')[1]?.toUpperCase();
  }
  return args;
}

async function catalogCounts(market?: string) {
  const where = market ? { marketCode: market } : {};
  const makes = await prisma.vehicleCatalogMake.groupBy({
    by: ['marketCode', 'vehicleType'],
    where,
    _count: { _all: true },
  });

  const rows: Array<{
    market: string;
    type: VehicleType;
    makes: number;
    models: number;
    generations: number;
    variants: number;
    variantsWithSpec: number;
    variantsWithOffering: number;
  }> = [];

  for (const m of makes) {
    const makeIds = (
      await prisma.vehicleCatalogMake.findMany({
        where: { marketCode: m.marketCode, vehicleType: m.vehicleType },
        select: { id: true },
      })
    ).map((x) => x.id);

    const models = await prisma.vehicleCatalogModel.count({
      where: { makeId: { in: makeIds } },
    });
    const generations = await prisma.vehicleCatalogGeneration.count({
      where: { model: { makeId: { in: makeIds } } },
    });
    const variants = await prisma.vehicleCatalogVariant.count({
      where: { generation: { model: { makeId: { in: makeIds } } } },
    });
    const variantsWithSpec = await prisma.vehicleCatalogVariant.count({
      where: {
        generation: { model: { makeId: { in: makeIds } } },
        spec: { isNot: null },
      },
    });
    const variantsWithOffering = await prisma.vehicleCatalogVariant.count({
      where: {
        generation: { model: { makeId: { in: makeIds } } },
        offerings: { some: {} },
      },
    });

    rows.push({
      market: m.marketCode,
      type: m.vehicleType,
      makes: m._count._all,
      models,
      generations,
      variants,
      variantsWithSpec,
      variantsWithOffering,
    });
  }

  return rows.sort((a, b) => a.market.localeCompare(b.market) || a.type.localeCompare(b.type));
}

async function unmatchedVehicles() {
  const total = await prisma.vehicle.count();
  const variantLinked = await prisma.vehicle.count({ where: { catalogVariantId: { not: null } } });
  const generationOnly = await prisma.vehicle.count({
    where: { catalogVariantId: null, catalogGenerationId: { not: null } },
  });
  const unlinked = total - variantLinked - generationOnly;

  const clusters = await prisma.vehicle.groupBy({
    by: ['vehicleType', 'make', 'model', 'year'],
    where: { catalogVariantId: null, catalogGenerationId: null },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
    take: 25,
  });

  return {
    total,
    variantLinked,
    generationOnly,
    unlinked,
    topUnlinked: clusters.map((c) => ({
      type: c.vehicleType,
      make: c.make,
      model: c.model,
      year: c.year,
      count: c._count._all,
    })),
  };
}

function pct(num: number, den: number): string {
  if (den === 0) return '—';
  return `${Math.round((num / den) * 1000) / 10}%`;
}

async function main() {
  const args = parseArgs();
  const counts = await catalogCounts(args.market);
  const vehicles = await unmatchedVehicles();

  if (args.json) {
    process.stdout.write(JSON.stringify({ counts, vehicles }, null, 2) + '\n');
    return;
  }

  console.log('\n=== Catalog coverage ===\n');
  console.log(
    'market  type        makes  models  gens   variants  w/spec        w/offering'
  );
  for (const r of counts) {
    const specCol = `${r.variantsWithSpec} (${pct(r.variantsWithSpec, r.variants)})`;
    const offCol = `${r.variantsWithOffering} (${pct(r.variantsWithOffering, r.variants)})`;
    console.log(
      `${r.market.padEnd(7)} ${r.type.padEnd(11)} ${String(r.makes).padEnd(6)} ${String(r.models).padEnd(7)} ${String(r.generations).padEnd(6)} ${String(r.variants).padEnd(9)} ${specCol.padEnd(13)} ${offCol}`
    );
  }

  console.log('\n=== User vehicles ===\n');
  console.log(`total: ${vehicles.total}`);
  console.log(`linked to variant:     ${vehicles.variantLinked} (${pct(vehicles.variantLinked, vehicles.total)})`);
  console.log(`linked to generation:  ${vehicles.generationOnly} (${pct(vehicles.generationOnly, vehicles.total)})`);
  console.log(`unlinked:              ${vehicles.unlinked} (${pct(vehicles.unlinked, vehicles.total)})`);

  if (vehicles.topUnlinked.length > 0) {
    console.log('\nTop fully-unlinked clusters (priority for catalog ingest):');
    for (const c of vehicles.topUnlinked) {
      console.log(`  ${String(c.count).padStart(4)}  ${c.type.padEnd(11)} ${c.make} ${c.model} ${c.year}`);
    }
  }
  console.log('');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
