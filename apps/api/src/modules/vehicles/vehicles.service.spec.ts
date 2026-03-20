import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { deleteStoredAttachmentFileMock } = vi.hoisted(() => ({
  deleteStoredAttachmentFileMock: vi.fn(),
}));

vi.mock('../attachments/utils/attachment-upload.util', () => ({
  deleteStoredAttachmentFile: deleteStoredAttachmentFileMock,
}));

import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  type VehicleDelegateMock = {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    $transaction: ReturnType<typeof vi.fn>;
    vehicle: VehicleDelegateMock;
  };

  const createdAt = new Date('2026-03-20T00:00:00.000Z');
  const vehicleRecord = {
    id: 'vehicle-1',
    userId: 'user-1',
    registrationNumber: 'MH12AB1234',
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX',
    year: 2022,
    fuelType: FuelType.Petrol,
    odometer: 12000,
    vehicleType: VehicleType.Car,
    nickname: 'Family car',
    createdAt,
    updatedAt: createdAt,
  };

  const prisma: PrismaMock = {
    $transaction: vi.fn(),
    vehicle: {
      count: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  let service: VehiclesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VehiclesService(prisma);
  });

  it('lists only the current user vehicles with pagination metadata', async () => {
    prisma.$transaction = vi.fn().mockResolvedValue([[vehicleRecord], 1]);

    const result = await service.listVehicles('user-1', {
      page: 1,
      limit: 20,
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 'vehicle-1',
          registrationNumber: 'MH12AB1234',
        }),
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
      },
    });
  });

  it('creates a vehicle scoped to the current user', async () => {
    prisma.vehicle.create = vi.fn().mockResolvedValue(vehicleRecord);

    const result = await service.createVehicle('user-1', {
      registrationNumber: 'MH12AB1234',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX',
      year: 2022,
      fuelType: FuelType.Petrol,
      odometer: 12000,
      vehicleType: VehicleType.Car,
      nickname: 'Family car',
    });

    expect(prisma.vehicle.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        registrationNumber: 'MH12AB1234',
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX',
        year: 2022,
        fuelType: FuelType.Petrol,
        odometer: 12000,
        vehicleType: VehicleType.Car,
        nickname: 'Family car',
      },
    });
    expect(result.id).toBe('vehicle-1');
  });

  it('maps duplicate registration errors to conflict', async () => {
    prisma.vehicle.create = vi.fn().mockRejectedValue(
      new PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'vitest',
      }),
    );

    await expect(
      service.createVehicle('user-1', {
        registrationNumber: 'MH12AB1234',
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX',
        year: 2022,
        fuelType: FuelType.Petrol,
        odometer: 12000,
        vehicleType: VehicleType.Car,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found when the vehicle is not owned by the current user', async () => {
    prisma.vehicle.findFirst = vi.fn().mockResolvedValue(null);

    await expect(service.getVehicleById('user-1', 'vehicle-404')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes related attachment files when a vehicle is deleted', async () => {
    prisma.vehicle.findFirst = vi.fn().mockResolvedValue({
      ...vehicleRecord,
      maintenanceRecords: [
        {
          attachments: [{ fileName: 'receipt-1.pdf' }, { fileName: 'receipt-2.jpg' }],
        },
      ],
    });
    prisma.vehicle.delete = vi.fn().mockResolvedValue({ id: 'vehicle-1' });

    const result = await service.deleteVehicle('user-1', 'vehicle-1');

    expect(prisma.vehicle.delete).toHaveBeenCalledWith({
      where: {
        id: 'vehicle-1',
      },
    });
    expect(deleteStoredAttachmentFileMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      id: 'vehicle-1',
      deleted: true,
    });
  });
});
