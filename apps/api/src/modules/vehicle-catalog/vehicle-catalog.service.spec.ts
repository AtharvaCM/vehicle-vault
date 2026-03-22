import { FuelType, VehicleCatalogMarket, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleCatalogService } from './vehicle-catalog.service';

describe('VehicleCatalogService', () => {
  const prisma = {
    vehicleCatalogMake: {
      findMany: vi.fn(),
    },
    vehicleCatalogModel: {
      findMany: vi.fn(),
    },
    vehicleCatalogVariant: {
      findMany: vi.fn(),
    },
  };

  let service: VehicleCatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VehicleCatalogService(prisma as never);
  });

  it('lists market-scoped makes for a vehicle type', async () => {
    prisma.vehicleCatalogMake.findMany.mockResolvedValue([
      {
        id: 'make-1',
        marketCode: 'IN',
        vehicleType: VehicleType.Car,
        name: 'Hyundai',
      },
    ]);

    await expect(
      service.listMakes({
        marketCode: VehicleCatalogMarket.India,
        vehicleType: VehicleType.Car,
      }),
    ).resolves.toEqual([
      {
        id: 'make-1',
        marketCode: VehicleCatalogMarket.India,
        vehicleType: VehicleType.Car,
        name: 'Hyundai',
      },
    ]);
  });

  it('lists models scoped by make and year', async () => {
    prisma.vehicleCatalogModel.findMany.mockResolvedValue([
      {
        id: 'model-1',
        makeId: 'make-1',
        name: 'Creta',
      },
    ]);

    await expect(
      service.listModels({
        make: 'Hyundai',
        marketCode: VehicleCatalogMarket.India,
        vehicleType: VehicleType.SUV,
        year: 2024,
      }),
    ).resolves.toEqual([
      {
        id: 'model-1',
        makeId: 'make-1',
        name: 'Creta',
      },
    ]);
  });

  it('lists variants with year and fuel type metadata', async () => {
    prisma.vehicleCatalogVariant.findMany.mockResolvedValue([
      {
        id: 'variant-1',
        modelId: 'model-1',
        name: 'SX (O)',
        fuelTypes: [FuelType.Petrol, FuelType.Diesel],
        yearStart: 2024,
        yearEnd: null,
        isCurrent: true,
      },
    ]);

    await expect(
      service.listVariants({
        make: 'Hyundai',
        marketCode: VehicleCatalogMarket.India,
        model: 'Creta',
        vehicleType: VehicleType.SUV,
        year: 2025,
      }),
    ).resolves.toEqual([
      {
        id: 'variant-1',
        modelId: 'model-1',
        name: 'SX (O)',
        fuelTypes: [FuelType.Petrol, FuelType.Diesel],
        yearStart: 2024,
        yearEnd: undefined,
        isCurrent: true,
      },
    ]);
  });
});
