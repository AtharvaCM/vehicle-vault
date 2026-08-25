import { MaintenanceCategory, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Per-variant service intervals, which `MaintenanceIntervalResolver` prefers
 * over its own type/fuel-gated defaults.
 *
 * These figures are OEM-published schedules for the Indian market. Treat them as
 * a starting point rather than gospel: confirm against the owner's manual before
 * adding a model, because a wrong number here outranks the conservative default
 * and reaches the user as a "due" or "overdue" badge.
 *
 * Omit a category rather than guessing — a missing entry falls back to the
 * resolver's default, which is the safe outcome. Note that tyre rotation is a
 * tyre-industry norm rather than an OEM schedule item, so it is left to the
 * default (10 000 km / 12 months) unless a manufacturer states otherwise.
 */
interface VariantIntervalSeed {
  make: string;
  model: string;
  /** Matched case-insensitively against the variant name; omit to apply to every variant of the model. */
  variantContains?: string;
  intervals: {
    category: MaintenanceCategory;
    intervalKm?: number;
    intervalMonths?: number;
    priority?: string;
    notes?: string;
  }[];
}

const SEEDS: VariantIntervalSeed[] = [
  {
    make: 'Hyundai',
    model: 'i20',
    intervals: [
      {
        category: MaintenanceCategory.engine_oil,
        intervalKm: 10000,
        intervalMonths: 12,
        priority: 'high',
        notes: 'Manufacturer recommended for BS6 i20 engines',
      },
      {
        category: MaintenanceCategory.periodic_service,
        intervalKm: 10000,
        intervalMonths: 12,
        priority: 'high',
        notes: 'Full service including air and oil filters',
      },
      {
        category: MaintenanceCategory.brake_pads,
        intervalKm: 25000,
        intervalMonths: 24,
        priority: 'medium',
        notes: 'Check thickness during every periodic service',
      },
    ],
  },
  {
    make: 'Volkswagen',
    model: 'Virtus',
    intervals: [
      {
        category: MaintenanceCategory.periodic_service,
        intervalKm: 15000,
        intervalMonths: 12,
        priority: 'high',
        notes: 'VW India schedule: 15 000 km or 12 months, whichever comes first',
      },
      {
        category: MaintenanceCategory.engine_oil,
        intervalKm: 15000,
        intervalMonths: 12,
        priority: 'high',
        notes: 'Long-life oil on the 1.0 TSI and 1.5 TSI; changed with the periodic service',
      },
    ],
  },
];

async function main() {
  let written = 0;

  for (const seed of SEEDS) {
    const variants = await prisma.vehicleCatalogVariant.findMany({
      where: {
        generation: {
          model: {
            name: { equals: seed.model, mode: 'insensitive' },
            make: { name: { equals: seed.make, mode: 'insensitive' } },
          },
        },
        ...(seed.variantContains
          ? { name: { contains: seed.variantContains, mode: 'insensitive' as const } }
          : {}),
      },
      select: { id: true, name: true },
    });

    if (variants.length === 0) {
      console.warn(
        `No catalog variant matched ${seed.make} ${seed.model}` +
          `${seed.variantContains ? ` (${seed.variantContains})` : ''} — skipping. ` +
          'Import the catalog first.',
      );
      continue;
    }

    for (const variant of variants) {
      for (const interval of seed.intervals) {
        // Upsert, not create: the seed is expected to be re-run, and
        // (variantId, category) is unique.
        await prisma.serviceInterval.upsert({
          where: {
            variantId_category: { variantId: variant.id, category: interval.category },
          },
          create: { variantId: variant.id, ...interval },
          update: {
            intervalKm: interval.intervalKm ?? null,
            intervalMonths: interval.intervalMonths ?? null,
            priority: interval.priority ?? 'medium',
            notes: interval.notes ?? null,
          },
        });
        written += 1;
      }
    }

    console.log(
      `${seed.make} ${seed.model}: ${seed.intervals.length} interval(s) across ${variants.length} variant(s)`,
    );
  }

  console.log(`Seed completed. ${written} service interval row(s) written.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
