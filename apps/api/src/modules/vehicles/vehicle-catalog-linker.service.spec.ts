import { FuelType, VehicleType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleCatalogLinkerService } from './vehicle-catalog-linker.service';

describe('VehicleCatalogLinkerService', () => {
  const prisma = {
    vehicleCatalogMakeAlias: {
      findMany: vi.fn(),
    },
    vehicleCatalogMake: {
      findMany: vi.fn(),
    },
    vehicleCatalogModelAlias: {
      findFirst: vi.fn(),
    },
    vehicleCatalogModel: {
      findFirst: vi.fn(),
    },
    vehicleCatalogGeneration: {
      findMany: vi.fn(),
    },
    vehicleCatalogVariant: {
      findMany: vi.fn(),
    },
    vehicle: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  const input = {
    make: 'Hyundai',
    model: 'Creta',
    year: 2024,
    vehicleType: VehicleType.suv,
    fuelType: FuelType.petrol,
  };

  let service: VehicleCatalogLinkerService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.vehicleCatalogMakeAlias.findMany.mockResolvedValue([{ makeId: 'make-1' }]);
    prisma.vehicleCatalogMake.findMany.mockResolvedValue([{ id: 'make-1' }]);
    prisma.vehicleCatalogModelAlias.findFirst.mockResolvedValue({ modelId: 'model-1' });
    prisma.vehicleCatalogModel.findFirst.mockResolvedValue({ id: 'model-1' });
    prisma.vehicleCatalogGeneration.findMany.mockResolvedValue([
      { id: 'generation-1', yearStart: 2024, yearEnd: null, isCurrent: true },
    ]);
    prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
      { id: 'variant-1', generationId: 'generation-1' },
    ]);
    prisma.vehicle.findMany.mockResolvedValue([]);
    prisma.vehicle.update.mockResolvedValue({});
    service = new VehicleCatalogLinkerService(prisma as never);
  });

  it('returns the single matching variant and generation', async () => {
    await expect(service.resolveCatalogLink(input)).resolves.toEqual({
      variantId: 'variant-1',
      generationId: 'generation-1',
    });

    expect(prisma.vehicleCatalogMakeAlias.findMany).toHaveBeenCalledWith({
      where: { normalizedAlias: 'hyundai' },
      select: { makeId: true },
    });
    expect(prisma.vehicleCatalogMake.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { slug: 'hyundai' },
          { name: { equals: 'Hyundai', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    expect(prisma.vehicleCatalogVariant.findMany).toHaveBeenCalledWith({
      where: {
        generationId: { in: ['generation-1'] },
        offerings: { some: { fuelTypes: { has: FuelType.petrol } } },
      },
      select: { id: true, generationId: true },
    });
  });

  it('returns a generation-only link when variants are ambiguous', async () => {
    prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
      { id: 'variant-1', generationId: 'generation-1' },
      { id: 'variant-2', generationId: 'generation-1' },
    ]);

    await expect(service.resolveCatalogLink(input)).resolves.toEqual({
      variantId: null,
      generationId: 'generation-1',
    });
  });

  it('prefers explicit year ranges over broader current generations', async () => {
    prisma.vehicleCatalogGeneration.findMany.mockResolvedValue([
      { id: 'lineup-generation', yearStart: null, yearEnd: null, isCurrent: true },
      { id: 'facelift-generation', yearStart: 2024, yearEnd: null, isCurrent: true },
    ]);
    prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
      { id: 'variant-1', generationId: 'facelift-generation' },
    ]);

    await expect(service.resolveCatalogLink(input)).resolves.toEqual({
      variantId: 'variant-1',
      generationId: 'facelift-generation',
    });
    expect(prisma.vehicleCatalogVariant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          generationId: { in: ['facelift-generation'] },
        }),
      }),
    );
  });

  it('falls back to current generations when the year is outside known ranges', async () => {
    prisma.vehicleCatalogGeneration.findMany.mockResolvedValue([
      { id: 'old-generation', yearStart: 2018, yearEnd: 2021, isCurrent: false },
      { id: 'current-generation', yearStart: null, yearEnd: null, isCurrent: true },
    ]);
    prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
      { id: 'variant-1', generationId: 'current-generation' },
    ]);

    await expect(service.resolveCatalogLink(input)).resolves.toEqual({
      variantId: 'variant-1',
      generationId: 'current-generation',
    });
  });

  it('returns no link when make or model cannot be resolved', async () => {
    await expect(service.resolveCatalogLink({ ...input, make: '   ' })).resolves.toEqual({
      variantId: null,
      generationId: null,
    });
    expect(prisma.vehicleCatalogMakeAlias.findMany).not.toHaveBeenCalled();

    prisma.vehicleCatalogMakeAlias.findMany.mockResolvedValue([]);
    prisma.vehicleCatalogMake.findMany.mockResolvedValue([]);

    await expect(service.resolveCatalogLink(input)).resolves.toEqual({
      variantId: null,
      generationId: null,
    });
    expect(prisma.vehicleCatalogModelAlias.findFirst).not.toHaveBeenCalled();
  });

  it('backfills only vehicles with a resolved catalog link', async () => {
    prisma.vehicle.findMany.mockResolvedValue([
      { id: 'vehicle-1', ...input },
      { id: 'vehicle-2', ...input, model: 'Unknown' },
    ]);
    prisma.vehicleCatalogModelAlias.findFirst
      .mockResolvedValueOnce({ modelId: 'model-1' })
      .mockResolvedValueOnce(null);
    prisma.vehicleCatalogModel.findFirst.mockResolvedValueOnce(null);

    await expect(service.backfillUnmatched()).resolves.toEqual({ scanned: 2, linked: 1 });
    expect(prisma.vehicle.update).toHaveBeenCalledTimes(1);
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: { catalogVariantId: 'variant-1', catalogGenerationId: 'generation-1' },
    });
  });
});
