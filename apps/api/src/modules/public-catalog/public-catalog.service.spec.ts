import { NotFoundException } from '@nestjs/common';
import { buildPublicCatalogMakePage, MaintenanceCategory } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceIntervalResolver } from '../vehicles/maintenance-interval.resolver';
import { PUBLIC_SPEC_FIELDS, PublicCatalogService } from './public-catalog.service';

const at = (iso: string) => new Date(iso);

function specRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'spec-1',
    variantId: 'variant-1',
    engineCc: 1197,
    powerPs: 83,
    transmission: 'Manual',
    mileageCombined: 20.3,
    fuelCapLitres: 37,
    rangeKm: null,
    batteryKwh: null,
    // Never public: free text, provenance and the commercial columns.
    safetyFeatures: 'Six airbags, ESC and more, copied from a listing',
    adasFeatures: 'Lane keep assist',
    grossWeightKg: 1500,
    payloadKg: null,
    sourceName: 'carwale',
    createdAt: at('2026-06-01T00:00:00Z'),
    updatedAt: at('2026-07-10T00:00:00Z'),
    ...overrides,
  };
}

function variantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'variant-1',
    generationId: 'generation-1',
    name: 'Asta',
    slug: 'asta',
    sourceName: 'carwale',
    sourceUrl: 'https://source.example.test/hyundai/i20/asta',
    createdAt: at('2026-06-01T00:00:00Z'),
    updatedAt: at('2026-06-02T00:00:00Z'),
    offerings: [
      {
        id: 'offering-old',
        fuelTypes: ['petrol'],
        yearStart: 2020,
        yearEnd: 2023,
        isCurrent: false,
        sourceName: 'carwale',
        sourceUrl: 'https://source.example.test/old',
        updatedAt: at('2026-06-03T00:00:00Z'),
      },
      {
        id: 'offering-current',
        fuelTypes: ['petrol', 'cng'],
        yearStart: 2023,
        yearEnd: null,
        isCurrent: true,
        sourceName: 'carwale',
        sourceUrl: 'https://source.example.test/current',
        updatedAt: at('2026-06-04T00:00:00Z'),
      },
    ],
    spec: specRow(),
    generation: {
      id: 'generation-1',
      name: 'i20 lineup',
      slug: 'i20-lineup',
      yearStart: 2020,
      yearEnd: null,
      isCurrent: true,
      sourceName: 'carwale',
      sourceUrl: 'https://source.example.test/hyundai/i20',
      variants: [
        { name: 'Asta', slug: 'asta' },
        { name: 'Magna', slug: 'magna' },
        { name: 'Sportz', slug: 'sportz' },
      ],
      model: {
        id: 'model-1',
        name: 'i20',
        slug: 'i20',
        sourceName: 'carwale',
        sourceUrl: 'https://source.example.test/hyundai/i20',
        make: {
          id: 'make-1',
          marketCode: 'IN',
          vehicleType: 'car',
          name: 'Hyundai',
          slug: 'hyundai',
          sourceName: 'carwale',
          sourceUrl: 'https://source.example.test/hyundai',
        },
      },
    },
    ...overrides,
  };
}

/** Enough public facts for the page-quality gate, combustion or electric. */
const richSpec = {
  engineCyl: 4,
  torqueNm: 115,
  lengthMm: 3995,
  widthMm: 1775,
  heightMm: 1505,
  seatingCapacity: 5,
  tyreSize: '195/55 R16',
  rangeKm: 489,
  motorKw: 110,
  batteryKwh: 45,
};

const slugs = {
  segment: 'cars' as const,
  make: 'hyundai',
  model: 'i20',
  generation: 'i20-lineup',
  variant: 'asta',
};

describe('PublicCatalogService', () => {
  const prisma = {
    vehicleCatalogVariant: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    vehicleCatalogModel: { findMany: vi.fn() },
    serviceInterval: { findMany: vi.fn() },
    vehicleCatalogVariantSpec: { findUnique: vi.fn() },
  };

  let service: PublicCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.serviceInterval.findMany.mockResolvedValue([]);
    prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue(null);
    prisma.vehicleCatalogVariant.findFirst.mockResolvedValue(variantRow());
    service = new PublicCatalogService(
      prisma as never,
      new MaintenanceIntervalResolver(prisma as never),
    );
  });

  describe('getVariantPage', () => {
    it('looks the variant up by its slug path, publishable rows only', async () => {
      await service.getVariantPage(slugs);

      expect(prisma.vehicleCatalogVariant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: 'asta',
            offerings: { some: {} },
            generation: {
              slug: 'i20-lineup',
              model: {
                slug: 'i20',
                make: {
                  slug: 'hyundai',
                  marketCode: 'IN',
                  vehicleType: { in: ['car', 'suv', 'van'] },
                },
              },
            },
          },
        }),
      );
    });

    it('limits /bikes to motorcycles, so trucks and other types never get a page', async () => {
      await service.getVariantPage({ ...slugs, segment: 'bikes' });

      const where = prisma.vehicleCatalogVariant.findFirst.mock.calls[0][0].where;
      expect(where.generation.model.make.vehicleType).toEqual({ in: ['motorcycle'] });
    });

    it('is not found when no publishable variant matches', async () => {
      prisma.vehicleCatalogVariant.findFirst.mockResolvedValue(null);

      await expect(service.getVariantPage(slugs)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns names, slugs and offerings, current first', async () => {
      const page = await service.getVariantPage(slugs);

      expect(page).toMatchObject({
        segment: 'cars',
        vehicleType: 'car',
        make: { name: 'Hyundai', slug: 'hyundai' },
        model: { name: 'i20', slug: 'i20' },
        generation: { name: 'i20 lineup', slug: 'i20-lineup', yearStart: 2020, isCurrent: true },
        variant: { name: 'Asta', slug: 'asta' },
        // The generation's other variants, never itself.
        siblings: [
          { name: 'Magna', slug: 'magna' },
          { name: 'Sportz', slug: 'sportz' },
        ],
      });
      expect(page.offerings).toEqual([
        { fuelTypes: ['petrol', 'cng'], yearStart: 2023, yearEnd: null, isCurrent: true },
        { fuelTypes: ['petrol'], yearStart: 2020, yearEnd: 2023, isCurrent: false },
      ]);
    });

    it('carries exactly the public spec fields, and missing ones as null', async () => {
      const page = await service.getVariantPage(slugs);

      expect(Object.keys(page.specs ?? {}).sort()).toEqual([...PUBLIC_SPEC_FIELDS].sort());
      expect(page.specs).toMatchObject({ engineCc: 1197, powerPs: 83, torqueNm: null });
    });

    it('never lets a source name, source URL, id or free-text field into the payload', async () => {
      const page = await service.getVariantPage(slugs);
      const serialized = JSON.stringify(page);

      for (const forbidden of [
        'sourceName',
        'sourceUrl',
        'source.example.test',
        'carwale',
        'importRun',
        'snapshot',
        'safetyFeatures',
        'adasFeatures',
        'grossWeightKg',
        'variant-1',
        'make-1',
        'spec-1',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it('returns null specs when the variant has no spec row', async () => {
      prisma.vehicleCatalogVariant.findFirst.mockResolvedValue(variantRow({ spec: null }));

      const page = await service.getVariantPage(slugs);

      expect(page.specs).toBeNull();
      expect(page.calculatorSeed.claimedMileage).toBeNull();
    });

    it('labels an all-default schedule as typical, resolved for the newest offering fuel', async () => {
      const page = await service.getVariantPage(slugs);

      expect(page.schedule).toMatchObject({
        basis: 'typical',
        fuelType: 'petrol',
        vehicleType: 'car',
      });
      expect(page.schedule.items.every((item) => item.source === 'default')).toBe(true);
      expect(page.schedule.items.map((item) => item.category)).toContain(
        MaintenanceCategory.EngineOil,
      );
      expect(prisma.serviceInterval.findMany).toHaveBeenCalledWith({
        where: { variantId: 'variant-1' },
      });
    });

    it("labels a schedule with any variant row as the variant's own", async () => {
      prisma.serviceInterval.findMany.mockResolvedValue([
        { category: 'periodic_service', intervalKm: 10000, intervalMonths: 12 },
      ]);

      const page = await service.getVariantPage(slugs);

      expect(page.schedule.basis).toBe('variant');
      expect(page.schedule.items).toContainEqual({
        category: MaintenanceCategory.PeriodicService,
        km: 10000,
        months: 12,
        source: 'variant',
      });
    });

    it('gives an electric variant no combustion items and seeds the calculator with range', async () => {
      prisma.vehicleCatalogVariant.findFirst.mockResolvedValue(
        variantRow({
          offerings: [
            {
              fuelTypes: ['electric'],
              yearStart: 2024,
              yearEnd: null,
              isCurrent: true,
              updatedAt: at('2026-06-04T00:00:00Z'),
            },
          ],
          spec: specRow({ mileageCombined: null, rangeKm: 465, batteryKwh: 45 }),
        }),
      );

      const page = await service.getVariantPage(slugs);
      const categories = page.schedule.items.map((item) => item.category);

      expect(page.schedule.fuelType).toBe('electric');
      for (const category of [
        MaintenanceCategory.EngineOil,
        MaintenanceCategory.OilFilter,
        MaintenanceCategory.AirFilter,
        MaintenanceCategory.Coolant,
        MaintenanceCategory.TimingBelt,
      ]) {
        expect(categories).not.toContain(category);
      }
      expect(page.calculatorSeed).toEqual({
        fuelType: 'electric',
        claimedMileage: null,
        claimedRangeKm: 465,
        batteryKwh: 45,
      });
    });

    it('gives a chain-drive motorcycle chain service and no timing belt, tyre rotation or alignment', async () => {
      const row = variantRow();
      row.generation.model.make.vehicleType = 'motorcycle';
      prisma.vehicleCatalogVariant.findFirst.mockResolvedValue(row);
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue({
        transmission: '5 Speed',
        driveType: 'Chain',
        coolingType: 'air-cooled',
      });

      const page = await service.getVariantPage({ ...slugs, segment: 'bikes' });
      const categories = page.schedule.items.map((item) => item.category);

      expect(categories).toContain(MaintenanceCategory.ChainService);
      expect(categories).not.toContain(MaintenanceCategory.TimingBelt);
      expect(categories).not.toContain(MaintenanceCategory.TyreRotation);
      expect(categories).not.toContain(MaintenanceCategory.WheelAlignment);
    });

    it('gives a TVS-Jupiter-shaped scooter no chain service, coolant, tyre rotation or alignment', async () => {
      const row = variantRow();
      row.generation.model.make.vehicleType = 'motorcycle';
      prisma.vehicleCatalogVariant.findFirst.mockResolvedValue(row);
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue({
        transmission: 'CVT',
        driveType: null,
        coolingType: 'air-cooled',
      });

      const page = await service.getVariantPage({ ...slugs, segment: 'bikes' });
      const categories = page.schedule.items.map((item) => item.category);

      expect(categories).not.toContain(MaintenanceCategory.ChainService);
      expect(categories).not.toContain(MaintenanceCategory.Coolant);
      expect(categories).not.toContain(MaintenanceCategory.TyreRotation);
      expect(categories).not.toContain(MaintenanceCategory.WheelAlignment);
      expect(page.schedule.items).toContainEqual({
        category: MaintenanceCategory.PeriodicService,
        km: 3000,
        months: 6,
        source: 'default',
      });
    });

    it('seeds the calculator with the claimed combined mileage for a combustion variant', async () => {
      const page = await service.getVariantPage(slugs);

      expect(page.calculatorSeed).toEqual({
        fuelType: 'petrol',
        claimedMileage: 20.3,
        claimedRangeKm: null,
        batteryKwh: null,
      });
    });

    it('reports the newest change across the variant, its offerings and its specs', async () => {
      const page = await service.getVariantPage(slugs);

      expect(page.updatedAt).toBe('2026-07-10T00:00:00.000Z');
    });
  });
  const publishableWhere = {
    offerings: { some: {} },
    generation: {
      model: {
        make: {
          marketCode: 'IN',
          vehicleType: { in: ['car', 'suv', 'van', 'motorcycle'] },
        },
      },
    },
  };

  describe('getIndex', () => {
    it('lists every publishable variant across both segments, in a stable order', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([]);

      await service.getIndex();

      expect(prisma.vehicleCatalogVariant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: publishableWhere, orderBy: { id: 'asc' } }),
      );
    });

    it('gives each variant its segment, names, slugs and newest change, and nothing else', async () => {
      const bike = variantRow({ id: 'variant-2', name: 'Classic 350', slug: 'classic-350' });
      bike.generation.model.make.vehicleType = 'motorcycle';
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([variantRow(), bike]);

      const index = await service.getIndex();

      expect(index.variants).toEqual([
        {
          segment: 'cars',
          vehicleType: 'car',
          make: { name: 'Hyundai', slug: 'hyundai' },
          model: { name: 'i20', slug: 'i20' },
          generation: { name: 'i20 lineup', slug: 'i20-lineup' },
          variant: { name: 'Asta', slug: 'asta' },
          // What a make page sums up: the newest offering's fuels first.
          fuelTypes: ['petrol', 'cng'],
          yearStart: 2020,
          yearEnd: null,
          isCurrent: true,
          indexable: false,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
        expect.objectContaining({
          segment: 'bikes',
          vehicleType: 'motorcycle',
          variant: { name: 'Classic 350', slug: 'classic-350' },
        }),
      ]);
      const serialized = JSON.stringify(index);
      for (const forbidden of ['sourceName', 'sourceUrl', 'carwale', 'variant-1', 'make-1']) {
        expect(serialized).not.toContain(forbidden);
      }
    });

    it("reports the page-quality gate's verdict, the same one the variant's page carries", async () => {
      const thin = variantRow({ id: 'variant-thin', slug: 'thin' });
      const rich = variantRow({ id: 'variant-rich', slug: 'rich', spec: specRow(richSpec) });
      const bare = variantRow({ id: 'variant-bare', slug: 'bare', spec: null });
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([thin, rich, bare]);

      const index = await service.getIndex();

      expect(index.variants.map((entry) => [entry.variant.slug, entry.indexable])).toEqual([
        ['thin', false],
        ['rich', true],
        ['bare', false],
      ]);
      for (const row of [thin, rich, bare]) {
        prisma.vehicleCatalogVariant.findFirst.mockResolvedValueOnce(row);
        const page = await service.getVariantPage(slugs);
        expect(page.indexable).toBe(
          index.variants.find((entry) => entry.variant.slug === row.slug)?.indexable,
        );
      }
      expect(JSON.stringify(index)).not.toContain('Six airbags');
    });

    it('judges an EV on its range, by the fuel of its newest offering', async () => {
      const ev = variantRow({
        spec: specRow({ ...richSpec, mileageCombined: null, engineCc: null, powerPs: null }),
        offerings: [
          {
            fuelTypes: ['electric'],
            yearStart: 2024,
            yearEnd: null,
            isCurrent: true,
            updatedAt: at('2026-06-04T00:00:00Z'),
          },
        ],
      });
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([ev]);

      await expect(service.getIndex()).resolves.toMatchObject({
        variants: [{ indexable: true }],
      });
    });

    it('drops a row of a type with no public segment', async () => {
      const truck = variantRow();
      truck.generation.model.make.vehicleType = 'truck';
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([truck]);

      await expect(service.getIndex()).resolves.toEqual({ variants: [] });
    });
  });

  describe('make and browse pages', () => {
    /** A variant row at an address, under a make row of the given type. */
    function rowAt({
      id,
      makeType = 'car',
      makeName = 'Hyundai',
      makeSlug = 'hyundai',
      model,
      variant,
      current = true,
      spec = specRow(),
      updatedAt = '2026-06-02T00:00:00Z',
    }: {
      id: string;
      makeType?: string;
      makeName?: string;
      makeSlug?: string;
      model: string;
      variant: string;
      current?: boolean;
      spec?: ReturnType<typeof specRow> | null;
      updatedAt?: string;
    }) {
      const row = variantRow({
        id,
        name: variant,
        slug: variant.toLowerCase(),
        updatedAt: at(updatedAt),
        spec,
        offerings: [
          {
            fuelTypes: ['petrol'],
            yearStart: 2019,
            yearEnd: current ? null : 2022,
            isCurrent: current,
            updatedAt: at('2026-06-01T00:00:00Z'),
          },
        ],
      });
      row.generation = {
        ...row.generation,
        slug: `${model.toLowerCase()}-lineup`,
        model: {
          ...row.generation.model,
          id: `model-${makeType}-${model}`,
          name: model,
          slug: model.toLowerCase(),
          make: {
            ...row.generation.model.make,
            id: `make-${makeType}`,
            vehicleType: makeType,
            name: makeName,
            slug: makeSlug,
          },
        },
      };
      return row;
    }

    // Hyundai is a car make and an SUV make with one slug; the i20 is under the
    // car row, the Creta under the SUV row, and the Venue under both.
    const hyundaiRows = () => [
      rowAt({ id: 'v1', model: 'i20', variant: 'Asta', spec: specRow() }),
      rowAt({ id: 'v2', makeType: 'suv', model: 'Creta', variant: 'SX', spec: specRow(richSpec) }),
      rowAt({ id: 'v3', model: 'Venue', variant: 'S', current: false }),
      rowAt({
        id: 'v4',
        makeType: 'suv',
        model: 'Venue',
        variant: 'SX',
        updatedAt: '2026-08-01T00:00:00Z',
      }),
      // The same Venue S address again from the SUV row: counted once.
      rowAt({ id: 'v5', makeType: 'suv', model: 'Venue', variant: 'S' }),
      rowAt({ id: 'v6', makeType: 'suv', model: 'Alcazar', variant: 'Base', current: false }),
    ];

    it('looks a make page up by slug across the segment’s vehicle types, publishable rows only', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue(hyundaiRows());

      await service.getMakePage({ segment: 'cars', make: 'hyundai' });

      expect(prisma.vehicleCatalogVariant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            offerings: { some: {} },
            generation: {
              model: {
                make: {
                  slug: 'hyundai',
                  marketCode: 'IN',
                  vehicleType: { in: ['car', 'suv', 'van'] },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        }),
      );
    });

    it('lists the models of every make row at the address, merged by model, on sale first', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue(hyundaiRows());

      const page = await service.getMakePage({ segment: 'cars', make: 'hyundai' });

      expect(page.make).toEqual({ name: 'Hyundai', slug: 'hyundai' });
      expect(page.models.map((model) => [model.name, model.variantCount, model.isCurrent])).toEqual(
        [
          ['Creta', 1, true],
          ['i20', 1, true],
          // The Venue S from both rows is one variant; the SX keeps it on sale.
          ['Venue', 2, true],
          ['Alcazar', 1, false],
        ],
      );
      expect(page.models.find((model) => model.slug === 'alcazar')).toMatchObject({
        fuelTypes: ['petrol'],
        yearStart: 2019,
        yearEnd: 2022,
      });
      expect(page.updatedAt).toBe('2026-08-01T00:00:00.000Z');
    });

    it('is indexable when any variant under it is, and not when none is', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue(hyundaiRows());
      await expect(
        service.getMakePage({ segment: 'cars', make: 'hyundai' }),
      ).resolves.toMatchObject({ indexable: true });

      prisma.vehicleCatalogVariant.findMany.mockResolvedValue(
        hyundaiRows().filter((row) => row.id !== 'v2'),
      );
      await expect(
        service.getMakePage({ segment: 'cars', make: 'hyundai' }),
      ).resolves.toMatchObject({ indexable: false });
    });

    it('is exactly what the shared builder makes of the index', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue(hyundaiRows());
      const page = await service.getMakePage({ segment: 'cars', make: 'hyundai' });
      const { variants } = await service.getIndex();

      expect(page).toEqual(buildPublicCatalogMakePage(variants, 'cars', 'hyundai'));
    });

    it('is not found when the make has nothing published', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([]);

      await expect(
        service.getMakePage({ segment: 'bikes', make: 'hyundai' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lists a segment’s makes by name, one per slug, with their model counts', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
        ...hyundaiRows(),
        rowAt({ id: 'v7', makeName: 'Honda', makeSlug: 'honda', model: 'City', variant: 'V' }),
      ]);

      const page = await service.getBrowsePage('cars');

      expect(prisma.vehicleCatalogVariant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            offerings: { some: {} },
            generation: {
              model: { make: { marketCode: 'IN', vehicleType: { in: ['car', 'suv', 'van'] } } },
            },
          },
        }),
      );
      expect(page).toEqual({
        segment: 'cars',
        makes: [
          { name: 'Honda', slug: 'honda', modelCount: 1 },
          { name: 'Hyundai', slug: 'hyundai', modelCount: 4 },
        ],
      });
    });

    it('gives an empty browse page, not an error, when a segment has nothing yet', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([]);

      await expect(service.getBrowsePage('bikes')).resolves.toEqual({
        segment: 'bikes',
        makes: [],
      });
    });
  });

  describe('getVariantPageBatch', () => {
    it('reads one page of publishable variants in index order', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([variantRow()]);
      prisma.vehicleCatalogVariant.count.mockResolvedValue(401);

      const batch = await service.getVariantPageBatch({ page: 3, pageSize: 200 });

      expect(prisma.vehicleCatalogVariant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: publishableWhere,
          orderBy: { id: 'asc' },
          skip: 400,
          take: 200,
        }),
      );
      expect(prisma.vehicleCatalogVariant.count).toHaveBeenCalledWith({ where: publishableWhere });
      expect(batch).toMatchObject({ page: 3, pageSize: 200, total: 401, hasMore: false });
    });

    it('says there is more while pages remain', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([variantRow()]);
      prisma.vehicleCatalogVariant.count.mockResolvedValue(401);

      const batch = await service.getVariantPageBatch({ page: 2, pageSize: 200 });

      expect(batch.hasMore).toBe(true);
    });

    it('returns for each variant exactly what its own page endpoint returns', async () => {
      const bike = variantRow({ id: 'variant-2', slug: 'classic-350' });
      bike.generation.model.make.vehicleType = 'motorcycle';
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([variantRow(), bike]);
      prisma.vehicleCatalogVariant.count.mockResolvedValue(2);

      const batch = await service.getVariantPageBatch({ page: 1, pageSize: 200 });
      const single = await service.getVariantPage(slugs);

      expect(batch.items).toHaveLength(2);
      expect(batch.items[0]).toEqual(single);
      expect(batch.items[1]).toMatchObject({ segment: 'bikes', vehicleType: 'motorcycle' });
      expect(JSON.stringify(batch)).not.toContain('sourceUrl');
    });
  });

  describe('getModelPage', () => {
    const modelSlugs = { segment: 'cars' as const, make: 'hyundai', model: 'i20' };

    const offering = (
      fuelTypes: string[],
      yearStart: number | null,
      yearEnd: number | null,
      isCurrent: boolean,
    ) => ({ fuelTypes, yearStart, yearEnd, isCurrent, updatedAt: at('2026-06-04T00:00:00Z') });

    /** A variant row of the i20 in a generation of our choosing. */
    function i20(
      id: string,
      name: string,
      generation: {
        slug: string;
        yearStart: number | null;
        yearEnd: number | null;
        isCurrent: boolean;
      },
      overrides: Record<string, unknown> = {},
    ) {
      const row = variantRow({
        id,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        spec: null,
        offerings: [offering(['petrol'], 2023, null, true)],
        ...overrides,
      });
      Object.assign(row.generation, {
        id: `generation-${generation.slug}`,
        name: `i20 ${generation.slug}`,
        ...generation,
      });
      return row;
    }

    const currentGen = { slug: 'third-gen', yearStart: 2020, yearEnd: null, isCurrent: true };
    const secondGen = { slug: 'second-gen', yearStart: 2014, yearEnd: 2020, isCurrent: false };
    const firstGen = { slug: 'first-gen', yearStart: 2008, yearEnd: 2014, isCurrent: false };

    it('looks up every publishable variant at the address, across car, SUV and van makes', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([variantRow()]);

      await service.getModelPage(modelSlugs);

      expect(prisma.vehicleCatalogVariant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            offerings: { some: {} },
            generation: {
              model: {
                slug: 'i20',
                make: {
                  slug: 'hyundai',
                  marketCode: 'IN',
                  vehicleType: { in: ['car', 'suv', 'van'] },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        }),
      );
    });

    it('limits /bikes to motorcycles', async () => {
      const bike = variantRow();
      bike.generation.model.make.vehicleType = 'motorcycle';
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([bike]);

      const page = await service.getModelPage({ ...modelSlugs, segment: 'bikes' });

      const where = prisma.vehicleCatalogVariant.findMany.mock.calls[0][0].where;
      expect(where.generation.model.make.vehicleType).toEqual({ in: ['motorcycle'] });
      expect(page).toMatchObject({ segment: 'bikes', vehicleType: 'motorcycle' });
    });

    it('is not found when no publishable variant is at the address', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([]);

      await expect(service.getModelPage(modelSlugs)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('groups variants by generation, current first, then the most recent', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
        i20('v1', 'Magna', firstGen, { offerings: [offering(['petrol'], 2008, 2014, false)] }),
        i20('v2', 'Asta', currentGen),
        i20('v3', 'Sportz', secondGen, { offerings: [offering(['diesel'], 2014, 2020, false)] }),
        i20('v4', 'Era', currentGen),
      ]);

      const page = await service.getModelPage(modelSlugs);

      expect(page.generations.map((generation) => generation.slug)).toEqual([
        'third-gen',
        'second-gen',
        'first-gen',
      ]);
      expect(page.generations[0]).toMatchObject({
        name: 'i20 third-gen',
        yearStart: 2020,
        yearEnd: null,
        isCurrent: true,
      });
      expect(page.generations.map((generation) => generation.variants.map((v) => v.name))).toEqual([
        ['Asta', 'Era'],
        ['Sportz'],
        ['Magna'],
      ]);
    });

    it('lists variants on sale before discontinued ones, then by name as a person sorts it', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
        i20('v1', 'Series 10', currentGen),
        i20('v2', 'Base', currentGen, { offerings: [offering(['petrol'], 2020, 2022, false)] }),
        i20('v3', 'Series 2', currentGen),
        i20('v4', 'asta', currentGen),
      ]);

      const page = await service.getModelPage(modelSlugs);

      expect(page.generations[0]?.variants.map((variant) => variant.name)).toEqual([
        'asta',
        'Series 2',
        'Series 10',
        'Base',
      ]);
    });

    it('sums up each variant: its fuels, the years it was sold, whether it still is, its gearbox', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
        i20('v1', 'Asta', currentGen, {
          offerings: [
            offering(['petrol'], 2020, 2023, false),
            offering(['cng', 'petrol'], 2023, null, true),
          ],
          spec: specRow({ transmission: 'CVT' }),
        }),
        i20('v2', 'Magna', secondGen, {
          offerings: [
            offering(['diesel'], 2016, 2020, false),
            offering(['petrol'], 2014, 2018, false),
          ],
        }),
      ]);

      const page = await service.getModelPage(modelSlugs);

      expect(page.generations[0]?.variants[0]).toEqual({
        name: 'Asta',
        slug: 'asta',
        fuelTypes: ['cng', 'petrol'],
        yearStart: 2020,
        yearEnd: null,
        isCurrent: true,
        transmission: 'CVT',
      });
      expect(page.generations[1]?.variants[0]).toEqual({
        name: 'Magna',
        slug: 'magna',
        fuelTypes: ['diesel', 'petrol'],
        yearStart: 2014,
        yearEnd: 2020,
        isCurrent: false,
        transmission: null,
      });
    });

    it('merges one model spread over two make rows with the same slug into one page', async () => {
      const car = i20('v1', 'Asta', currentGen);
      const suv = i20('v2', 'Sportz', currentGen);
      suv.generation.model = { ...suv.generation.model, id: 'model-2' };
      suv.generation.model.make = {
        ...suv.generation.model.make,
        id: 'make-2',
        vehicleType: 'suv',
      };
      const older = i20('v3', 'Magna', secondGen, {
        offerings: [offering(['petrol'], 2014, 2020, false)],
      });
      older.generation.model.make = {
        ...older.generation.model.make,
        id: 'make-2',
        vehicleType: 'suv',
      };
      // The same generation and variant slugs under both makes: listed once, first row wins.
      const twin = i20('v4', 'Asta', currentGen, {
        offerings: [offering(['diesel'], 2020, null, true)],
      });
      twin.generation.model.make = {
        ...twin.generation.model.make,
        id: 'make-2',
        vehicleType: 'suv',
      };
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([car, suv, older, twin]);

      const page = await service.getModelPage(modelSlugs);

      expect(page.generations.map((generation) => generation.slug)).toEqual([
        'third-gen',
        'second-gen',
      ]);
      expect(page.generations[0]?.variants).toEqual([
        expect.objectContaining({ name: 'Asta', fuelTypes: ['petrol'] }),
        expect.objectContaining({ name: 'Sportz' }),
      ]);
      expect(page.generations[1]?.variants.map((variant) => variant.name)).toEqual(['Magna']);
    });

    it('takes its specs and schedule from the newest variant on sale in the current generation, and says which', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
        i20('v-old', 'Magna', secondGen, {
          offerings: [offering(['petrol'], 2014, 2020, false)],
          spec: specRow({ ...richSpec }),
        }),
        i20('v-ended', 'Base', currentGen, {
          offerings: [offering(['petrol'], 2020, 2021, false)],
          spec: specRow({ ...richSpec }),
        }),
        i20('v-2021', 'Sportz', currentGen, {
          offerings: [offering(['petrol'], 2021, null, true)],
          spec: specRow({ ...richSpec }),
        }),
        i20('v-2024', 'Asta', currentGen, {
          offerings: [offering(['diesel'], 2024, null, true)],
          spec: specRow({ ...richSpec, transmission: 'DCT' }),
        }),
      ]);

      const page = await service.getModelPage(modelSlugs);

      expect(page.representative).toMatchObject({
        generation: { name: 'i20 third-gen', slug: 'third-gen' },
        variant: { name: 'Asta', slug: 'asta' },
        specs: { transmission: 'DCT', engineCc: 1197 },
      });
      expect(page.schedule).toMatchObject({
        basis: 'typical',
        fuelType: 'diesel',
        vehicleType: 'car',
      });
      expect(prisma.serviceInterval.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.serviceInterval.findMany).toHaveBeenCalledWith({
        where: { variantId: 'v-2024' },
      });
    });

    it('prefers a variant the page-quality gate passes, so the specs shown say something', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
        i20('v-thin', 'Asta', currentGen, { offerings: [offering(['petrol'], 2024, null, true)] }),
        i20('v-rich', 'Sportz', currentGen, {
          offerings: [offering(['petrol'], 2021, null, true)],
          spec: specRow({ ...richSpec }),
        }),
      ]);

      const page = await service.getModelPage(modelSlugs);

      expect(page.representative.variant.slug).toBe('sportz');
    });

    it("gives the representative's schedule exactly as its own variant page has it", async () => {
      prisma.serviceInterval.findMany.mockResolvedValue([
        { category: 'periodic_service', intervalKm: 10000, intervalMonths: 12 },
      ]);
      const row = variantRow();
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([row]);
      prisma.vehicleCatalogVariant.findFirst.mockResolvedValue(row);

      const modelPage = await service.getModelPage(modelSlugs);
      const variantPage = await service.getVariantPage(slugs);

      expect(modelPage.schedule).toEqual(variantPage.schedule);
      expect(modelPage.schedule.basis).toBe('variant');
      expect(modelPage.representative.specs).toEqual(variantPage.specs);
    });

    it('is indexable if and only if at least one of its variants is', async () => {
      const thin = i20('v-thin', 'Asta', currentGen, { spec: specRow() });
      const bare = i20('v-bare', 'Era', currentGen);
      const rich = i20('v-rich', 'Sportz', secondGen, {
        offerings: [offering(['petrol'], 2014, 2020, false)],
        spec: specRow({ ...richSpec }),
      });

      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([thin, bare]);
      await expect(service.getModelPage(modelSlugs)).resolves.toMatchObject({ indexable: false });

      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([thin, bare, rich]);
      await expect(service.getModelPage(modelSlugs)).resolves.toMatchObject({ indexable: true });
    });

    it('reports the newest change across all its variants', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
        i20('v1', 'Asta', currentGen, { updatedAt: at('2026-08-01T00:00:00Z') }),
        i20('v2', 'Era', currentGen, { spec: specRow({ updatedAt: at('2026-09-01T00:00:00Z') }) }),
      ]);

      const page = await service.getModelPage(modelSlugs);

      expect(page.updatedAt).toBe('2026-09-01T00:00:00.000Z');
    });

    it('never lets a source name, source URL, id or free-text field into the payload', async () => {
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([variantRow()]);

      const serialized = JSON.stringify(await service.getModelPage(modelSlugs));

      for (const forbidden of [
        'sourceName',
        'sourceUrl',
        'source.example.test',
        'carwale',
        'safetyFeatures',
        'Six airbags',
        'variant-1',
        'generation-1',
        'model-1',
        'make-1',
        'spec-1',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
    });
  });

  describe('getModelPageBatch', () => {
    const modelRow = (id: string, slug: string, make: string, vehicleType: string) => ({
      id,
      slug,
      make: { slug: make, vehicleType },
    });

    /** A variant row under a given model row. */
    function underModel(
      id: string,
      model: { id: string; slug: string },
      makeSlug: string,
      vehicleType: string,
    ) {
      const row = variantRow({ id, slug: id });
      row.generation.model = {
        ...row.generation.model,
        id: model.id,
        slug: model.slug,
        name: model.slug,
      };
      row.generation.model.make = {
        ...row.generation.model.make,
        slug: makeSlug,
        name: makeSlug,
        vehicleType,
      };
      return row;
    }

    it('reads publishable models only, then their variants in id order', async () => {
      prisma.vehicleCatalogModel.findMany.mockResolvedValue([
        modelRow('m1', 'i20', 'hyundai', 'car'),
      ]);
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
        underModel('v1', { id: 'm1', slug: 'i20' }, 'hyundai', 'car'),
      ]);

      await service.getModelPageBatch({ page: 1, pageSize: 100 });

      expect(prisma.vehicleCatalogModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            make: { marketCode: 'IN', vehicleType: { in: ['car', 'suv', 'van', 'motorcycle'] } },
            generations: { some: { variants: { some: { offerings: { some: {} } } } } },
          },
        }),
      );
      expect(prisma.vehicleCatalogVariant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { offerings: { some: {} }, generation: { modelId: { in: ['m1'] } } },
          orderBy: { id: 'asc' },
        }),
      );
    });

    it('pages by address, in address order, one address spanning two make rows', async () => {
      prisma.vehicleCatalogModel.findMany.mockResolvedValue([
        modelRow('m-venue', 'venue', 'hyundai', 'suv'),
        modelRow('m-classic', 'classic-350', 'royal-enfield', 'motorcycle'),
        modelRow('m-i20-car', 'i20', 'hyundai', 'car'),
        modelRow('m-i20-suv', 'i20', 'hyundai', 'suv'),
        modelRow('m-ace', 'ace', 'tata', 'truck'),
      ]);
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
        underModel('v1', { id: 'm-i20-car', slug: 'i20' }, 'hyundai', 'car'),
        underModel('v2', { id: 'm-i20-suv', slug: 'i20' }, 'hyundai', 'suv'),
      ]);

      const first = await service.getModelPageBatch({ page: 1, pageSize: 2 });

      // bikes/royal-enfield/classic-350, then cars/hyundai/i20, then cars/hyundai/venue; no truck.
      expect(first).toMatchObject({ page: 1, pageSize: 2, total: 3, hasMore: true });
      expect(prisma.vehicleCatalogVariant.findMany.mock.calls[0][0].where.generation).toEqual({
        modelId: { in: ['m-classic', 'm-i20-car', 'm-i20-suv'] },
      });
      const i20Page = first.items.find((item) => item.model.slug === 'i20');
      expect(i20Page?.generations[0]?.variants.map((variant) => variant.slug)).toEqual([
        'v1',
        'v2',
      ]);

      prisma.vehicleCatalogVariant.findMany.mockResolvedValue([]);
      const last = await service.getModelPageBatch({ page: 2, pageSize: 2 });
      expect(last).toMatchObject({ page: 2, total: 3, hasMore: false });
      expect(prisma.vehicleCatalogVariant.findMany.mock.calls[1][0].where.generation).toEqual({
        modelId: { in: ['m-venue'] },
      });
    });

    it('asks for no variants past the last page', async () => {
      prisma.vehicleCatalogModel.findMany.mockResolvedValue([
        modelRow('m1', 'i20', 'hyundai', 'car'),
      ]);

      const batch = await service.getModelPageBatch({ page: 5, pageSize: 100 });

      expect(batch).toEqual({ items: [], page: 5, pageSize: 100, total: 1, hasMore: false });
      expect(prisma.vehicleCatalogVariant.findMany).not.toHaveBeenCalled();
    });

    it('returns for each address exactly what its own model page endpoint returns', async () => {
      const rows = [variantRow(), variantRow({ id: 'variant-2', name: 'Sportz', slug: 'sportz' })];
      prisma.vehicleCatalogModel.findMany.mockResolvedValue([
        modelRow('model-1', 'i20', 'hyundai', 'car'),
      ]);
      prisma.vehicleCatalogVariant.findMany.mockResolvedValue(rows);

      const batch = await service.getModelPageBatch({ page: 1, pageSize: 100 });
      const single = await service.getModelPage({ segment: 'cars', make: 'hyundai', model: 'i20' });

      expect(batch.items).toEqual([single]);
    });
  });
});
