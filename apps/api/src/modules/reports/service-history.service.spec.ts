import { Prisma } from '@prisma/client';
import { FuelType, VehicleType, MaintenanceCategory } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceHistoryService } from './service-history.service';

describe('ServiceHistoryService.buildPdf', () => {
  const prisma = {
    vehicle: { findFirst: vi.fn() },
    maintenanceRecord: { findMany: vi.fn() },
    fuelLog: { findMany: vi.fn() },
    insurancePolicy: { findMany: vi.fn() },
    claim: { findMany: vi.fn() },
  };

  let service: ServiceHistoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceHistoryService(prisma as never);
  });

  it('returns a PDF buffer with the registration number in the file name', async () => {
    prisma.vehicle.findFirst.mockResolvedValue({
      id: 'vehicle-1',
      userId: 'user-1',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX',
      year: 2022,
      registrationNumber: 'MH12 AB 1234',
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
      odometer: 25000,
      nickname: 'Daily driver',
      purchaseDate: new Date('2022-01-15T00:00:00.000Z'),
      purchasePrice: new Prisma.Decimal('850000.00'),
      purchaseOdometer: 0,
    });
    prisma.maintenanceRecord.findMany.mockResolvedValue([
      {
        id: 'r1',
        vehicleId: 'vehicle-1',
        serviceDate: new Date('2024-06-12T00:00:00.000Z'),
        odometer: 18000,
        category: MaintenanceCategory.EngineOil,
        workshopName: 'Trusted Garage',
        totalCost: new Prisma.Decimal('2499.00'),
      },
    ]);
    prisma.fuelLog.findMany.mockResolvedValue([
      {
        date: new Date('2024-05-01T00:00:00.000Z'),
        totalCost: new Prisma.Decimal('1500.00'),
        odometer: 15000,
        quantity: 15,
      },
      {
        date: new Date('2024-06-01T00:00:00.000Z'),
        totalCost: new Prisma.Decimal('1600.00'),
        odometer: 16000,
        quantity: 16,
      },
    ]);
    prisma.insurancePolicy.findMany.mockResolvedValue([]);
    prisma.claim.findMany.mockResolvedValue([]);

    const result = await service.buildPdf('user-1', 'vehicle-1');

    expect(result.buffer.length).toBeGreaterThan(500);
    expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');
    expect(result.fileName).toMatch(/^service-history-MH12AB1234-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('throws NotFound when vehicle is not owned by user', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);
    await expect(service.buildPdf('user-1', 'v-missing')).rejects.toMatchObject({ status: 404 });
  });
});
