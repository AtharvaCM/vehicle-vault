import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Prisma, VehicleRole } from '@prisma/client';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };
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

  const intervalResolver = {
    resolveForVehicle: vi.fn().mockResolvedValue({}),
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
      intervalResolver as never,
      productEvents as never,
    );
  });

  it('lists only vehicles the user is a member of, with pagination metadata', async () => {
    prisma.$transaction = vi.fn().mockResolvedValue([[vehicleRecord], 1]);

    const result = await service.listVehicles('user-1', { page: 1, limit: 20 });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({
      data: [expect.objectContaining({ id: 'vehicle-1', registrationNumber: 'MH12AB1234' })],
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
    expect(productEvents.record).toHaveBeenCalledWith(prisma, {
      name: 'vehicle_created',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
    });
  });

  it('marks a vehicle created from a catalog intent on its event, and nowhere else', async () => {
    prisma.vehicle.create = vi.fn().mockResolvedValue(vehicleRecord);

    await service.createVehicle('user-1', {
      registrationNumber: 'MH12AB1234',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX',
      year: 2022,
      fuelType: FuelType.Petrol,
      odometer: 12000,
      vehicleType: VehicleType.Car,
      fromCatalogIntent: true,
    });

    expect(productEvents.record).toHaveBeenCalledWith(prisma, {
      name: 'vehicle_created',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
      properties: { fromCatalogIntent: true },
    });
    // Not a vehicle column: it must not reach the row Prisma writes.
    expect(prisma.vehicle.create.mock.calls[0]?.[0]?.data).not.toHaveProperty('fromCatalogIntent');
  });

  it('creates a vehicle with no variant, and still links it by make, model and year', async () => {
    catalogLinker.resolveCatalogLink.mockResolvedValueOnce({
      variantId: null,
      generationId: 'generation-1',
    });
    prisma.vehicle.create = vi.fn().mockResolvedValue({ ...vehicleRecord, variant: null });

    const result = await service.createVehicle('user-1', {
      registrationNumber: 'MH12AB1234',
      make: 'Hyundai',
      model: 'Creta',
      year: 2022,
      fuelType: FuelType.Petrol,
      odometer: 12000,
      vehicleType: VehicleType.Car,
    });

    // Nothing invented in place of the missing trim.
    expect(prisma.vehicle.create.mock.calls[0]?.[0]?.data).not.toHaveProperty('variant');
    // The linker never read the free-text variant; it still narrows to a generation.
    expect(catalogLinker.resolveCatalogLink).toHaveBeenCalledWith({
      make: 'Hyundai',
      model: 'Creta',
      year: 2022,
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
    });
    expect(prisma.vehicle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        catalogVariantId: undefined,
        catalogGenerationId: 'generation-1',
      }),
    });
    expect(result.variant).toBeUndefined();
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

  it('relinks catalog references when only the variant changes to one typed by hand', async () => {
    accessService.assert.mockResolvedValueOnce(VehicleRole.editor);
    const before = { ...vehicleRecord, catalogVariantId, catalogGenerationId };
    prisma.vehicle.findUnique = vi.fn().mockResolvedValue(before);
    catalogLinker.resolveCatalogLink.mockResolvedValueOnce({
      variantId: null,
      generationId: catalogGenerationId,
    });
    prisma.vehicle.update = vi.fn().mockResolvedValue({
      ...before,
      variant: 'SX Knight',
      catalogVariantId: null,
    });

    // The form sends no catalogVariantId when the variant matches no catalog
    // option, so the old link would otherwise still describe the SX.
    await service.updateVehicle('user-1', 'vehicle-1', { variant: 'SX Knight' });

    expect(catalogLinker.resolveCatalogLink).toHaveBeenCalledWith({
      make: 'Hyundai',
      model: 'Creta',
      year: 2022,
      vehicleType: VehicleType.Car,
      fuelType: FuelType.Petrol,
    });
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: {
        variant: 'SX Knight',
        catalogVariantId: null,
        catalogGenerationId,
      },
    });
  });

  it('relinks catalog references when the variant is cleared', async () => {
    accessService.assert.mockResolvedValueOnce(VehicleRole.editor);
    const before = { ...vehicleRecord, catalogVariantId, catalogGenerationId };
    prisma.vehicle.findUnique = vi.fn().mockResolvedValue(before);
    catalogLinker.resolveCatalogLink.mockResolvedValueOnce({
      variantId: null,
      generationId: catalogGenerationId,
    });
    prisma.vehicle.update = vi.fn().mockResolvedValue({
      ...before,
      variant: null,
      catalogVariantId: null,
    });

    await service.updateVehicle('user-1', 'vehicle-1', { variant: null });

    expect(catalogLinker.resolveCatalogLink).toHaveBeenCalled();
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: {
        variant: null,
        catalogVariantId: null,
        catalogGenerationId,
      },
    });
  });

  it('keeps the catalog variant the caller picked alongside a new variant', async () => {
    accessService.assert.mockResolvedValueOnce(VehicleRole.editor);
    prisma.vehicle.findUnique = vi.fn().mockResolvedValue(vehicleRecord);
    prisma.vehicle.update = vi.fn().mockResolvedValue({
      ...vehicleRecord,
      variant: 'SX(O)',
      catalogVariantId,
    });

    await service.updateVehicle('user-1', 'vehicle-1', { variant: 'SX(O)', catalogVariantId });

    expect(catalogLinker.resolveCatalogLink).not.toHaveBeenCalled();
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: { variant: 'SX(O)', catalogVariantId },
    });
  });

  it('updating the nickname leaves purchase price, date and odometer untouched', async () => {
    accessService.assert.mockResolvedValueOnce(VehicleRole.editor);
    const before = {
      ...vehicleRecord,
      purchaseDate: new Date('2022-01-01T00:00:00.000Z'),
      purchasePrice: 850_000,
      purchaseOdometer: 10,
    };
    prisma.vehicle.findUnique = vi.fn().mockResolvedValue(before);
    prisma.vehicle.update = vi.fn().mockResolvedValue({ ...before, nickname: 'Highway cruiser' });

    await service.updateVehicle('user-1', 'vehicle-1', { nickname: 'Highway cruiser' });

    expect(catalogLinker.resolveCatalogLink).not.toHaveBeenCalled();
    // Only the changed field is written: an explicit `null` here would wipe
    // the stored purchase details, and this must not become one.
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: { nickname: 'Highway cruiser' },
    });
  });

  it('stores the engine oil the owner records, and reads the litres back as a number (#332)', async () => {
    accessService.assert.mockResolvedValueOnce(VehicleRole.owner);
    prisma.vehicle.findUnique = vi.fn().mockResolvedValue(vehicleRecord);
    prisma.vehicle.update = vi.fn().mockResolvedValue({
      ...vehicleRecord,
      engineOilGrade: '5W-30',
      engineOilLitres: new Prisma.Decimal('3.8'),
    });

    const vehicle = await service.updateVehicle('user-1', 'vehicle-1', {
      engineOilGrade: '5W-30',
      engineOilLitres: 3.8,
    });

    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: { engineOilGrade: '5W-30', engineOilLitres: 3.8 },
    });
    expect(vehicle).toMatchObject({ engineOilGrade: '5W-30', engineOilLitres: 3.8 });
  });

  it('clears the nickname and variant when the edit sends an explicit null', async () => {
    accessService.assert.mockResolvedValueOnce(VehicleRole.editor);
    prisma.vehicle.findUnique = vi.fn().mockResolvedValue(vehicleRecord);
    prisma.vehicle.update = vi
      .fn()
      .mockResolvedValue({ ...vehicleRecord, nickname: null, variant: null });

    const vehicle = await service.updateVehicle('user-1', 'vehicle-1', {
      nickname: null,
      variant: null,
    });

    // Prisma reads `undefined` as "leave unchanged"; only `null` clears the column.
    // Clearing the variant also re-resolves the catalog link, which finds nothing here.
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'vehicle-1' },
      data: {
        nickname: null,
        variant: null,
        catalogVariantId: null,
        catalogGenerationId: null,
      },
    });
    expect(vehicle.nickname).toBeUndefined();
    expect(vehicle.variant).toBeUndefined();
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

  it('names the linked catalog variant’s body type, and null without one (#356)', async () => {
    accessService.assert.mockResolvedValueOnce(VehicleRole.owner);
    prisma.vehicle.findUnique = vi.fn().mockResolvedValueOnce({
      ...vehicleRecord,
      catalogVariant: { spec: { bodyType: ' Scooter ' } },
    });
    await expect(service.getVehicleById('user-1', vehicleRecord.id)).resolves.toMatchObject({
      catalogBodyType: 'Scooter',
    });

    accessService.assert.mockResolvedValueOnce(VehicleRole.owner);
    prisma.vehicle.findUnique = vi.fn().mockResolvedValueOnce({
      ...vehicleRecord,
      catalogVariant: null,
    });
    await expect(service.getVehicleById('user-1', vehicleRecord.id)).resolves.toMatchObject({
      catalogBodyType: null,
    });
  });

  it('returns not found when the user has no membership on the vehicle', async () => {
    accessService.assert.mockRejectedValueOnce(
      new NotFoundException('Vehicle vehicle-404 was not found'),
    );

    await expect(service.getVehicleById('user-1', 'vehicle-404')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes every stored file the vehicle owns when an owner deletes it', async () => {
    prisma.vehicle.findUnique = vi.fn().mockResolvedValue({
      ...vehicleRecord,
      maintenanceRecords: [
        {
          attachments: [{ fileName: 'receipt-1.pdf' }, { fileName: 'receipt-2.jpg' }],
        },
      ],
      insurancePolicies: [{ attachments: [{ fileName: 'policy.pdf' }] }],
      warranties: [{ attachments: [{ fileName: 'warranty-card.jpg' }] }],
      loans: [{ attachments: [{ fileName: 'sanction-letter.pdf' }] }],
      complianceDocuments: [{ attachments: [{ fileName: 'puc-certificate.jpg' }] }],
    });
    prisma.vehicle.delete = vi.fn().mockResolvedValue({ id: 'vehicle-1' });

    const result = await service.deleteVehicle('user-1', 'vehicle-1');

    expect(accessService.assertOwner).toHaveBeenCalledWith('user-1', 'vehicle-1');
    expect(prisma.vehicle.delete).toHaveBeenCalledWith({ where: { id: 'vehicle-1' } });
    // The cascade removes the rows; without this the files would outlive them.
    expect(storageService.deleteObject.mock.calls.map(([path]) => path).sort()).toEqual([
      'policy.pdf',
      'puc-certificate.jpg',
      'receipt-1.pdf',
      'receipt-2.jpg',
      'sanction-letter.pdf',
      'warranty-card.jpg',
    ]);
    expect(result).toEqual({ id: 'vehicle-1', deleted: true });
  });

  it('resolves service intervals from the vehicle, so clients need no interval of their own', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({
      ...vehicleRecord,
      catalogVariantId: 'variant-1',
      vehicleType: 'car',
      fuelType: 'petrol',
    });
    intervalResolver.resolveForVehicle.mockResolvedValue({
      tyre_rotation: { km: 15000, months: 12, source: 'variant' },
    });

    const intervals = await service.getServiceIntervals('user-1', 'vehicle-1');

    // Access is enforced by going through getVehicleById.
    expect(accessService.assert).toHaveBeenCalledWith('user-1', 'vehicle-1', 'viewer');
    expect(intervalResolver.resolveForVehicle).toHaveBeenCalledWith({
      catalogVariantId: 'variant-1',
      vehicleType: 'car',
      fuelType: 'petrol',
    });
    expect(intervals).toEqual({ tyre_rotation: { km: 15000, months: 12, source: 'variant' } });
  });

  describe('updateOdometer', () => {
    it('records a higher reading and audits it in the same transaction', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(vehicleRecord);
      prisma.vehicle.update.mockResolvedValue({ ...vehicleRecord, odometer: 12500 });

      const vehicle = await service.updateOdometer('user-1', 'vehicle-1', 12500);

      expect(accessService.assert).toHaveBeenCalledWith('user-1', 'vehicle-1', 'editor');
      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'vehicle-1' },
        data: { odometer: 12500 },
      });
      expect(auditService.track).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'vehicle.updated',
          resourceId: 'vehicle-1',
          before: expect.objectContaining({ odometer: 12000 }),
          after: expect.objectContaining({ odometer: 12500 }),
        }),
      );
      expect(vehicle.odometer).toBe(12500);
    });

    it('refuses a reading below the current one and points at the edit form', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(vehicleRecord);

      const attempt = service.updateOdometer('user-1', 'vehicle-1', 11999);

      await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
      await expect(attempt).rejects.toMatchObject({
        response: {
          message: expect.stringMatching(/already reads 12,000 km.*edit the vehicle/),
        },
      });
      expect(prisma.vehicle.update).not.toHaveBeenCalled();
      expect(auditService.track).not.toHaveBeenCalled();
    });

    it('accepts the same reading again, which confirms the odometer is current', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(vehicleRecord);
      prisma.vehicle.update.mockResolvedValue(vehicleRecord);

      await service.updateOdometer('user-1', 'vehicle-1', 12000);

      expect(prisma.vehicle.update).toHaveBeenCalled();
    });

    it('leaves a viewer to the access check, touching nothing', async () => {
      accessService.assert.mockRejectedValue(new ForbiddenException());

      await expect(service.updateOdometer('user-2', 'vehicle-1', 13000)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.vehicle.update).not.toHaveBeenCalled();
    });

    it('refuses a vehicle that does not exist', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.updateOdometer('user-1', 'vehicle-1', 13000)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('dismissSetupPrompt', () => {
    it('stamps the vehicle so the expiry prompt does not come back', async () => {
      prisma.vehicle.findUnique.mockResolvedValue({
        ...vehicleRecord,
        setupPromptDismissedAt: null,
      });
      prisma.vehicle.update.mockImplementation(
        async ({ data }: { data: { setupPromptDismissedAt: Date } }) => ({
          ...vehicleRecord,
          setupPromptDismissedAt: data.setupPromptDismissedAt,
        }),
      );

      const vehicle = await service.dismissSetupPrompt('user-1', 'vehicle-1');

      expect(accessService.assert).toHaveBeenCalledWith('user-1', 'vehicle-1', 'editor');
      expect(vehicle.setupPromptDismissedAt).not.toBeNull();
    });

    it('keeps the first dismissal rather than restarting the clock', async () => {
      const dismissedAt = new Date('2026-09-01T10:00:00.000Z');
      prisma.vehicle.findUnique.mockResolvedValue({
        ...vehicleRecord,
        setupPromptDismissedAt: dismissedAt,
      });

      const vehicle = await service.dismissSetupPrompt('user-1', 'vehicle-1');

      expect(prisma.vehicle.update).not.toHaveBeenCalled();
      expect(vehicle.setupPromptDismissedAt).toBe(dismissedAt.toISOString());
    });

    it('refuses a vehicle that does not exist', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.dismissSetupPrompt('user-1', 'vehicle-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
