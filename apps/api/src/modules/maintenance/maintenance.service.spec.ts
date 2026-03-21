import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MaintenanceCategory } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  type MaintenanceRecordDelegateMock = {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    $transaction: ReturnType<typeof vi.fn>;
    maintenanceRecord: MaintenanceRecordDelegateMock;
  };

  const createdAt = new Date('2026-03-20T00:00:00.000Z');
  const serviceDate = new Date('2026-03-18T00:00:00.000Z');

  const record = {
    id: 'record-1',
    vehicleId: 'vehicle-1',
    category: MaintenanceCategory.EngineOil,
    serviceDate,
    odometer: 12345,
    workshopName: 'Trusted Garage',
    totalCost: new Prisma.Decimal(2499),
    notes: 'Changed engine oil',
    nextDueDate: new Date('2026-06-18T00:00:00.000Z'),
    nextDueOdometer: 18000,
    createdAt,
    updatedAt: createdAt,
  };

  const prisma: PrismaMock = {
    $transaction: vi.fn(),
    maintenanceRecord: {
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  const vehiclesService = {
    ensureVehicleExists: vi.fn().mockResolvedValue({
      id: 'vehicle-1',
      odometer: 12345,
    }),
  };

  const storageService = {
    deleteObject: vi.fn().mockResolvedValue(undefined),
  };

  let service: MaintenanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    storageService.deleteObject.mockResolvedValue(undefined);
    service = new MaintenanceService(
      prisma as never,
      vehiclesService as never,
      storageService as never,
    );
  });

  it('lists maintenance records for a vehicle with ownership check and pagination', async () => {
    prisma.$transaction = vi.fn().mockResolvedValue([[record], 1]);

    const result = await service.listForVehicle('user-1', 'vehicle-1', {
      page: 1,
      limit: 20,
    });

    expect(vehiclesService.ensureVehicleExists).toHaveBeenCalledWith('user-1', 'vehicle-1');
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      vehicleId: 'vehicle-1',
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'record-1',
        totalCost: 2499,
      }),
    );
  });

  it('creates a maintenance record with database-safe date and decimal values', async () => {
    prisma.maintenanceRecord.create = vi.fn().mockResolvedValue(record);

    const result = await service.createForVehicle('user-1', 'vehicle-1', {
      category: MaintenanceCategory.EngineOil,
      serviceDate: '2026-03-18T00:00:00.000Z',
      odometer: 12345,
      workshopName: 'Trusted Garage',
      totalCost: 2499,
      notes: 'Changed engine oil',
      nextDueDate: '2026-06-18T00:00:00.000Z',
      nextDueOdometer: 18000,
    });

    expect(prisma.maintenanceRecord.create).toHaveBeenCalledWith({
      data: {
        vehicleId: 'vehicle-1',
        category: MaintenanceCategory.EngineOil,
        serviceDate: new Date('2026-03-18T00:00:00.000Z'),
        odometer: 12345,
        workshopName: 'Trusted Garage',
        totalCost: 2499,
        notes: 'Changed engine oil',
        nextDueDate: new Date('2026-06-18T00:00:00.000Z'),
        nextDueOdometer: 18000,
      },
    });
    expect(result.totalCost).toBe(2499);
  });

  it('returns not found when the requested record is outside the user scope', async () => {
    prisma.maintenanceRecord.findFirst = vi.fn().mockResolvedValue(null);

    await expect(service.getRecordById('user-1', 'record-404')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes linked attachment objects when a maintenance record is removed', async () => {
    prisma.maintenanceRecord.findFirst = vi.fn().mockResolvedValue({
      ...record,
      attachments: [{ fileName: 'receipt-1.pdf' }],
    });
    prisma.maintenanceRecord.delete = vi.fn().mockResolvedValue({ id: 'record-1' });

    const result = await service.deleteRecord('user-1', 'record-1');

    expect(storageService.deleteObject).toHaveBeenCalledWith('receipt-1.pdf');
    expect(result).toEqual({
      id: 'record-1',
      deleted: true,
    });
  });
});
