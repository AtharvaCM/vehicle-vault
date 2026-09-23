import { MaintenanceCategory } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceIntervalResolver } from './maintenance-interval.resolver';

describe('MaintenanceIntervalResolver', () => {
  const prisma = {
    serviceInterval: {
      findMany: vi.fn(),
    },
    vehicleCatalogVariantSpec: {
      findUnique: vi.fn(),
    },
  };

  let resolver: MaintenanceIntervalResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.serviceInterval.findMany.mockResolvedValue([]);
    prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue(null);
    resolver = new MaintenanceIntervalResolver(prisma as never);
  });

  const petrolCar = { catalogVariantId: null, vehicleType: 'car', fuelType: 'petrol' };
  const petrolMotorcycle = {
    catalogVariantId: null,
    vehicleType: 'motorcycle',
    fuelType: 'petrol',
  };

  describe('cars', () => {
    it('returns defaults for an unlinked petrol car, without two-wheeler-only items', async () => {
      const intervals = await resolver.resolveForVehicle(petrolCar);
      expect(intervals[MaintenanceCategory.EngineOil]).toEqual({
        km: 7500,
        months: 6,
        source: 'default',
      });
      expect(intervals[MaintenanceCategory.TimingBelt]).toBeDefined();
      expect(intervals[MaintenanceCategory.TyreRotation]).toBeDefined();
      expect(intervals[MaintenanceCategory.WheelAlignment]).toBeDefined();
      expect(intervals[MaintenanceCategory.ChainService]).toBeUndefined();
      expect(prisma.vehicleCatalogVariantSpec.findUnique).not.toHaveBeenCalled();
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

    it('never gives a car a two-wheeler-only variant override', async () => {
      prisma.serviceInterval.findMany.mockResolvedValue([
        { category: 'chain_service', intervalKm: 400, intervalMonths: null },
      ]);
      const intervals = await resolver.resolveForVehicle({
        ...petrolCar,
        catalogVariantId: 'variant-1',
      });
      expect(intervals[MaintenanceCategory.ChainService]).toBeUndefined();
      expect(prisma.vehicleCatalogVariantSpec.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('two-wheelers', () => {
    it('uses the two-wheeler defaults and never tyre rotation, alignment or timing belt', async () => {
      const intervals = await resolver.resolveForVehicle(petrolMotorcycle);

      expect(intervals[MaintenanceCategory.PeriodicService]).toEqual({
        km: 3000,
        months: 6,
        source: 'default',
      });
      expect(intervals[MaintenanceCategory.EngineOil]).toBeDefined();
      expect(intervals[MaintenanceCategory.AirFilter]).toBeDefined();
      expect(intervals[MaintenanceCategory.BrakePads]).toBeDefined();
      expect(intervals[MaintenanceCategory.TyreRotation]).toBeUndefined();
      expect(intervals[MaintenanceCategory.WheelAlignment]).toBeUndefined();
      expect(intervals[MaintenanceCategory.TimingBelt]).toBeUndefined();
      expect(intervals[MaintenanceCategory.OilFilter]).toBeUndefined();
    });

    it('gives an unlinked motorcycle no chain service or coolant — the drivetrain is unknown', async () => {
      const intervals = await resolver.resolveForVehicle(petrolMotorcycle);

      expect(intervals[MaintenanceCategory.ChainService]).toBeUndefined();
      expect(intervals[MaintenanceCategory.Coolant]).toBeUndefined();
      expect(prisma.vehicleCatalogVariantSpec.findUnique).not.toHaveBeenCalled();
    });

    it('gives a chain-drive motorcycle chain service, once the catalog says so', async () => {
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue({
        transmission: '5 Speed',
        driveType: 'Chain Drive',
        coolingType: 'air-cooled',
      });

      const intervals = await resolver.resolveForVehicle({
        ...petrolMotorcycle,
        catalogVariantId: 'variant-re-classic-350',
      });

      expect(intervals[MaintenanceCategory.ChainService]).toEqual({
        km: 500,
        months: 1,
        source: 'default',
      });
      expect(intervals[MaintenanceCategory.Coolant]).toBeUndefined();
      expect(prisma.vehicleCatalogVariantSpec.findUnique).toHaveBeenCalledWith({
        where: { variantId: 'variant-re-classic-350' },
        select: { transmission: true, driveType: true, coolingType: true },
      });
    });

    it('gives a liquid-cooled motorcycle coolant', async () => {
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue({
        transmission: '6 Speed',
        driveType: 'Chain',
        coolingType: 'liquid-cooled',
      });

      const intervals = await resolver.resolveForVehicle({
        ...petrolMotorcycle,
        catalogVariantId: 'variant-liquid-cooled',
      });

      expect(intervals[MaintenanceCategory.Coolant]).toEqual({
        km: 20000,
        months: 24,
        source: 'default',
      });
      expect(intervals[MaintenanceCategory.ChainService]).toBeDefined();
    });

    /**
     * The motivating case: a TVS-Jupiter-shaped scooter (air-cooled, CVT,
     * unknown/belt final drive — the catalog doesn't record a drive type for
     * it). It must not get chain service, coolant, tyre rotation or wheel
     * alignment.
     */
    it('gives a TVS-Jupiter-shaped scooter no chain service, coolant, tyre rotation or alignment', async () => {
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue({
        transmission: 'CVT',
        driveType: null,
        coolingType: 'air-cooled',
      });

      const intervals = await resolver.resolveForVehicle({
        ...petrolMotorcycle,
        catalogVariantId: 'variant-tvs-jupiter',
      });

      expect(intervals[MaintenanceCategory.ChainService]).toBeUndefined();
      expect(intervals[MaintenanceCategory.Coolant]).toBeUndefined();
      expect(intervals[MaintenanceCategory.TyreRotation]).toBeUndefined();
      expect(intervals[MaintenanceCategory.WheelAlignment]).toBeUndefined();
      expect(intervals[MaintenanceCategory.PeriodicService]).toEqual({
        km: 3000,
        months: 6,
        source: 'default',
      });
    });

    it('gives a motorcycle with an unrecorded drive and cooling type neither chain service nor coolant', async () => {
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue({
        transmission: null,
        driveType: null,
        coolingType: null,
      });

      const intervals = await resolver.resolveForVehicle({
        ...petrolMotorcycle,
        catalogVariantId: 'variant-unknown-drivetrain',
      });

      expect(intervals[MaintenanceCategory.ChainService]).toBeUndefined();
      expect(intervals[MaintenanceCategory.Coolant]).toBeUndefined();
      // Everything else the two-wheeler table doesn't gate on drivetrain still applies.
      expect(intervals[MaintenanceCategory.PeriodicService]).toBeDefined();
      expect(intervals[MaintenanceCategory.BrakePads]).toBeDefined();
    });

    it('excludes combustion-only categories for an electric motorcycle, but keeps chain service', async () => {
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue({
        transmission: '1 Speed',
        driveType: 'Chain',
        coolingType: null,
      });

      const intervals = await resolver.resolveForVehicle({
        ...petrolMotorcycle,
        fuelType: 'electric',
        catalogVariantId: 'variant-electric-chain',
      });

      expect(intervals[MaintenanceCategory.EngineOil]).toBeUndefined();
      expect(intervals[MaintenanceCategory.AirFilter]).toBeUndefined();
      expect(intervals[MaintenanceCategory.ChainService]).toBeDefined();
      expect(intervals[MaintenanceCategory.PeriodicService]).toBeDefined();
    });

    it('a per-variant override for tyre rotation never reaches a two-wheeler', async () => {
      prisma.serviceInterval.findMany.mockResolvedValue([
        { category: 'tyre_rotation', intervalKm: 5000, intervalMonths: null },
        { category: 'periodic_service', intervalKm: 4000, intervalMonths: 6 },
      ]);

      const intervals = await resolver.resolveForVehicle({
        ...petrolMotorcycle,
        catalogVariantId: 'variant-1',
      });

      expect(intervals[MaintenanceCategory.TyreRotation]).toBeUndefined();
      expect(intervals[MaintenanceCategory.PeriodicService]).toEqual({
        km: 4000,
        months: 6,
        source: 'variant',
      });
    });

    it('a per-variant chain-service override still requires the catalog to say chain drive', async () => {
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue({
        transmission: 'CVT',
        driveType: null,
        coolingType: 'air-cooled',
      });
      prisma.serviceInterval.findMany.mockResolvedValue([
        { category: 'chain_service', intervalKm: 400, intervalMonths: null },
      ]);

      const intervals = await resolver.resolveForVehicle({
        ...petrolMotorcycle,
        catalogVariantId: 'variant-tvs-jupiter',
      });

      expect(intervals[MaintenanceCategory.ChainService]).toBeUndefined();
    });
  });

  describe('resolveForVariant', () => {
    const petrolCarVariant = { variantId: 'variant-1', vehicleType: 'car', fuelType: 'petrol' };

    it('resolves a variant with no vehicle, reading its own interval rows', async () => {
      prisma.serviceInterval.findMany.mockResolvedValue([
        { category: 'engine_oil', intervalKm: 10000, intervalMonths: 12 },
      ]);
      const intervals = await resolver.resolveForVariant(petrolCarVariant);

      expect(prisma.serviceInterval.findMany).toHaveBeenCalledWith({
        where: { variantId: 'variant-1' },
      });
      expect(intervals[MaintenanceCategory.EngineOil]).toEqual({
        km: 10000,
        months: 12,
        source: 'variant',
      });
      expect(intervals[MaintenanceCategory.BrakePads]).toMatchObject({ source: 'default' });
    });

    it('gates an electric variant off every combustion-only item, even from variant rows', async () => {
      prisma.serviceInterval.findMany.mockResolvedValue([
        { category: 'engine_oil', intervalKm: 10000, intervalMonths: 12 },
      ]);
      const intervals = await resolver.resolveForVariant({
        ...petrolCarVariant,
        fuelType: 'electric',
      });

      for (const category of [
        MaintenanceCategory.EngineOil,
        MaintenanceCategory.OilFilter,
        MaintenanceCategory.AirFilter,
        MaintenanceCategory.Coolant,
        MaintenanceCategory.TimingBelt,
      ]) {
        expect(intervals[category]).toBeUndefined();
      }
      expect(intervals[MaintenanceCategory.PeriodicService]).toBeDefined();
    });

    it('gives a chain-drive motorcycle variant chain service and no timing belt, tyre rotation or alignment', async () => {
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValue({
        transmission: '5 Speed',
        driveType: 'Chain',
        coolingType: 'air-cooled',
      });

      const intervals = await resolver.resolveForVariant({
        ...petrolCarVariant,
        vehicleType: 'motorcycle',
      });

      expect(intervals[MaintenanceCategory.ChainService]).toBeDefined();
      expect(intervals[MaintenanceCategory.TimingBelt]).toBeUndefined();
      expect(intervals[MaintenanceCategory.TyreRotation]).toBeUndefined();
      expect(intervals[MaintenanceCategory.WheelAlignment]).toBeUndefined();
    });

    it('returns defaults only, without a variant-spec lookup, when there is no variant', async () => {
      const intervals = await resolver.resolveForVariant({ ...petrolCarVariant, variantId: null });

      expect(prisma.serviceInterval.findMany).not.toHaveBeenCalled();
      expect(prisma.vehicleCatalogVariantSpec.findUnique).not.toHaveBeenCalled();
      expect(Object.values(intervals).every((interval) => interval?.source === 'default')).toBe(
        true,
      );
    });

    it('is what resolveForVehicle returns for the same vehicle', async () => {
      prisma.serviceInterval.findMany.mockResolvedValue([
        { category: 'periodic_service', intervalKm: 15000, intervalMonths: 12 },
      ]);
      const forVehicle = await resolver.resolveForVehicle({
        ...petrolCar,
        catalogVariantId: 'variant-1',
      });
      const forVariant = await resolver.resolveForVariant(petrolCarVariant);

      expect(forVariant).toEqual(forVehicle);
    });
  });
});
