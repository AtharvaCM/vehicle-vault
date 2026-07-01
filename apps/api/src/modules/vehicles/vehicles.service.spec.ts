import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { VehicleRole } from '@prisma/client';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  type VehicleDelegateMock = {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    $transaction: ReturnType<typeof vi.fn>;
    vehicle: VehicleDelegateMock;
  };

  const createdAt = new Date('2026-03-20T00:00:00.000Z');
  const catalogVariantId = '11111111-1111-4111-8111-111111111111';
  const catalogGenerationId = '22222222-2222-4222-8222-222222222222';
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
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  const storageService = {
    deleteObject: vi.fn().mockResolvedValue(undefined),
  };

  const auditService = {
    track: vi.fn().mockResolvedValue(undefined),
  };

  const accessService = {
    resolve: vi.fn().mockResolvedValue(VehicleRole.owner),
    assert: vi.fn().mockResolvedValue(VehicleRole.owner),
    assertOwner: vi.fn().mockResolvedValue(VehicleRole.owner),
    assertEditor: vi.fn().mockResolvedValue(VehicleRole.owner),
    listAccessibleVehicleIds: vi.fn().mockResolvedValue([]),
  };

  const catalogLinker = {
    findMatchingVariantId: vi.fn().mockResolvedValue(null),
    resolveCatalogLink: vi.fn().mockResolvedValue({ variantId: null, generationId: null }),
  };

  let service: VehiclesService;

  beforeEach(() => {
    vi.clearAllMocks();
    storageService.deleteObject.mockResolvedValue('deleted');
    auditService.track.mockResolvedValue(undefined);
    accessService.assert.mockResolvedValue(VehicleRole.owner);
    accessService.assertOwner.mockResolvedValue(VehicleRole.owner);
    catalogLinker.findMatchingVariantId.mockResolvedValue(null);
    catalogLinker.resolveCatalogLink.mockResolvedValue({ variantId: null, generationId: null });
    prisma.$transaction = vi.fn().mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => unknown)(prisma);
      }
      return Array.isArray(arg) ? arg : undefined;
    });
    service = new VehiclesService(
      prisma as never,
      storageService as never,
      auditService as never,
      accessService as never,
      catalogLinker as never,
    );
  });

  it('lists only vehicles the user is a member of, with pagination metadata', async () => {
    prisma.$transaction = vi.fn().mockResolvedValue([[vehicleRecord], 1]);

    const result = await service.listVehicles('user-1', { page: 1, limit: 20 });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({
      data: [
        expect.objectContaining({ id: 'vehicle-1', registrationNumber: 'MH12AB1234' }),
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });

  it('creates a vehicle and the owner membership row', async () => {
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
      data: expect.objectContaining({
        userId: 'user-1',
        members: { create: { userId: 'user-1', role: VehicleRole.owner } },
      }),
    });
    expect(result.id).toBe('vehicle-1');
  });

  it('auto-links a created vehicle to the resolved catalog references', async () => {
    catalogLinker.resolveCatalogLink.mockResolvedValueOnce({
      variantId: catalogVariantId,
      generationId: catalogGenerationId,
    });
    prisma.vehicle.create = vi.fn().mockResolvedValue({
      ...vehicleRecord,
      catalogVariantId,
      catalogGenerationId,
    });

    await service.createVehicle('user-1', {
      registrationNumber: 'MH12AB1234',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX',
      year: 2022,
      fuelType: FuelType.Petrol,
      odometer: 12000,
      vehicleType: VehicleType.Car,
    });

    expect(catalogLinker.resolveCatalogLink).toHaveBeenCalledWith({
      make: 'Hyundai',
      model: 'Creta',
      year: 2022,
      vehicleType: VehicleType.Car,
      fuelType: FuelType.Petrol,
    });
    expect(prisma.vehicle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        catalogVariantId,
        catalogGenerationId,
      }),
    });
  });

  it('does not auto-link when the caller supplies a catalog variant', async () => {
    prisma.vehicle.create = vi.fn().mockResolvedValue({
      ...vehicleRecord,
      catalogVariantId,
    });

    await service.createVehicle('user-1', {
      registrationNumber: 'MH12AB1234',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX',
      year: 2022,
      fuelType: FuelType.Petrol,
      odometer: 12000,
      vehicleType: VehicleType.Car,
      catalogVariantId,
    });

    expect(catalogLinker.resolveCatalogLink).not.toHaveBeenCalled();
    expect(prisma.vehicle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ catalogVariantId }),
    });
  });

  it('relinks catalog references when identifying fields change', async () => {
    accessService.assert.mockResolvedValueOnce(VehicleRole.editor);
    prisma.vehicle.findUnique = vi.fn().mockResolvedValue(vehicleRecord);
    catalogLinker.resolveCatalogLink.mockResolvedValueOnce({
      variantId: null,
      generationId: catalogGenerationId,
    });
    prisma.vehicle.update = vi.fn().mockResolvedValue({
      ...vehicleRecord,
      model: 'Creta Facelift',
      catalogVariantId: null,
      catalogGenerationId,
    });

    await service.updateVehicle('user-1', 'vehicle-1', { model: 'Creta Facelift' });

    expect(catalogLinker.resolveCatalogLink).toHaveBeenCalledWith({
      make: 'Hyundai',
      model: 'Creta Facelift',
      year: 2022,
      vehicleType: VehicleType.Car,
      fuelType: FuelType.Petrol,
    });
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: {
        model: 'Creta Facelift',
        catalogVariantId: null,
        catalogGenerationId,
      },
    });
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

  it('returns not found when the user has no membership on the vehicle', async () => {
    accessService.assert.mockRejectedValueOnce(new NotFoundException('Vehicle vehicle-404 was not found'));

    await expect(service.getVehicleById('user-1', 'vehicle-404')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes related attachment objects when an owner deletes a vehicle', async () => {
    prisma.vehicle.findUnique = vi.fn().mockResolvedValue({
      ...vehicleRecord,
      maintenanceRecords: [
        {
          attachments: [{ fileName: 'receipt-1.pdf' }, { fileName: 'receipt-2.jpg' }],
        },
      ],
    });
    prisma.vehicle.delete = vi.fn().mockResolvedValue({ id: 'vehicle-1' });

    const result = await service.deleteVehicle('user-1', 'vehicle-1');

    expect(accessService.assertOwner).toHaveBeenCalledWith('user-1', 'vehicle-1');
    expect(prisma.vehicle.delete).toHaveBeenCalledWith({ where: { id: 'vehicle-1' } });
    expect(storageService.deleteObject).toHaveBeenCalledTimes(2);
    expect(storageService.deleteObject).toHaveBeenCalledWith('receipt-1.pdf');
    expect(storageService.deleteObject).toHaveBeenCalledWith('receipt-2.jpg');
    expect(result).toEqual({ id: 'vehicle-1', deleted: true });
  });
});
