import { NotFoundException } from '@nestjs/common';
import { MaintenanceCategory } from '@vehicle-vault/shared';
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

const slugs = {
  segment: 'cars' as const,
  make: 'hyundai',
  model: 'i20',
  generation: 'i20-lineup',
  variant: 'asta',
};

describe('PublicCatalogService', () => {
  const prisma = {
    vehicleCatalogVariant: { findFirst: vi.fn() },
    serviceInterval: { findMany: vi.fn() },
  };

  let service: PublicCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.serviceInterval.findMany.mockResolvedValue([]);
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

    it('gives a motorcycle chain service and no timing belt', async () => {
      const row = variantRow();
      row.generation.model.make.vehicleType = 'motorcycle';
      prisma.vehicleCatalogVariant.findFirst.mockResolvedValue(row);

      const page = await service.getVariantPage({ ...slugs, segment: 'bikes' });
      const categories = page.schedule.items.map((item) => item.category);

      expect(categories).toContain(MaintenanceCategory.ChainService);
      expect(categories).not.toContain(MaintenanceCategory.TimingBelt);
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
});
