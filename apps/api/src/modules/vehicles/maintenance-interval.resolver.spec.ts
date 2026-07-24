import { MaintenanceCategory } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceIntervalResolver } from './maintenance-interval.resolver';

describe('MaintenanceIntervalResolver', () => {
  const prisma = {
    serviceInterval: {
      findMany: vi.fn(),
    },
  };

  let resolver: MaintenanceIntervalResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.serviceInterval.findMany.mockResolvedValue([]);
    resolver = new MaintenanceIntervalResolver(prisma as never);
  });

  const petrolCar = { catalogVariantId: null, vehicleType: 'car', fuelType: 'petrol' };

  it('returns defaults for an unlinked petrol car, without motorcycle-only items', async () => {
    const intervals = await resolver.resolveForVehicle(petrolCar);
    expect(intervals[MaintenanceCategory.EngineOil]).toEqual({
      km: 7500,
      months: 6,
      source: 'default',
    });
    expect(intervals[MaintenanceCategory.TimingBelt]).toBeDefined();
    expect(intervals[MaintenanceCategory.ChainService]).toBeUndefined();
    expect(prisma.serviceInterval.findMany).not.toHaveBeenCalled();
  });

  it('gates motorcycle-only and car-only categories by vehicle type', async () => {
    const intervals = await resolver.resolveForVehicle({
      ...petrolCar,
      vehicleType: 'motorcycle',
    });
    expect(intervals[MaintenanceCategory.ChainService]).toBeDefined();
    expect(intervals[MaintenanceCategory.TimingBelt]).toBeUndefined();
  });

  it('excludes combustion-only categories for electric vehicles', async () => {
    const intervals = await resolver.resolveForVehicle({
      ...petrolCar,
      fuelType: 'electric',
    });
    expect(intervals[MaintenanceCategory.EngineOil]).toBeUndefined();
    expect(intervals[MaintenanceCategory.OilFilter]).toBeUndefined();
    expect(intervals[MaintenanceCategory.Coolant]).toBeUndefined();
    expect(intervals[MaintenanceCategory.TyreRotation]).toBeDefined();
  });

  it('prefers per-variant catalog intervals over defaults', async () => {
    prisma.serviceInterval.findMany.mockResolvedValue([
      { category: 'engine_oil', intervalKm: 10000, intervalMonths: 12 },
    ]);
    const intervals = await resolver.resolveForVehicle({
      ...petrolCar,
      catalogVariantId: 'variant-1',
    });
    expect(intervals[MaintenanceCategory.EngineOil]).toEqual({
      km: 10000,
      months: 12,
      source: 'variant',
    });
    // Untouched categories keep their defaults.
    expect(intervals[MaintenanceCategory.BrakePads]).toMatchObject({ source: 'default' });
  });

  it('ignores empty variant rows and inapplicable variant categories', async () => {
    prisma.serviceInterval.findMany.mockResolvedValue([
      { category: 'engine_oil', intervalKm: null, intervalMonths: null },
      { category: 'chain_service', intervalKm: 600, intervalMonths: null },
    ]);
    const intervals = await resolver.resolveForVehicle({
      ...petrolCar,
      catalogVariantId: 'variant-1',
    });
    expect(intervals[MaintenanceCategory.EngineOil]).toMatchObject({ source: 'default' });
    // chain_service does not apply to a car even if the variant data has it.
    expect(intervals[MaintenanceCategory.ChainService]).toBeUndefined();
  });

  it('keeps a null km from variant data (time-based-only interval)', async () => {
    prisma.serviceInterval.findMany.mockResolvedValue([
      { category: 'periodic_service', intervalKm: null, intervalMonths: 6 },
    ]);
    const intervals = await resolver.resolveForVehicle({
      ...petrolCar,
      catalogVariantId: 'variant-1',
    });
    expect(intervals[MaintenanceCategory.PeriodicService]).toEqual({
      km: null,
      months: 6,
      source: 'variant',
    });
  });
});
