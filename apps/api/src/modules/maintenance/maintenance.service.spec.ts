import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MaintenanceCategory,
  MaintenanceLineItemKind,
  MaintenanceRecordStatus,
  MaintenanceSource,
} from '@vehicle-vault/shared';
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
    invoiceNumber: 'INV-2026-001',
    currencyCode: 'INR',
    source: MaintenanceSource.Manual,
    status: MaintenanceRecordStatus.Confirmed,
    totalCost: new Prisma.Decimal(2499),
    laborCost: new Prisma.Decimal(499),
    partsCost: new Prisma.Decimal(1800),
    fluidsCost: new Prisma.Decimal(200),
    taxCost: new Prisma.Decimal(0),
    discountAmount: new Prisma.Decimal(0),
    notes: 'Changed engine oil',
    metadata: { advisor: 'Aman' },
    nextDueDate: new Date('2026-06-18T00:00:00.000Z'),
    nextDueOdometer: 18000,
    createdAt,
    updatedAt: createdAt,
    lineItems: [
      {
        id: 'item-1',
        maintenanceRecordId: 'record-1',
        kind: MaintenanceLineItemKind.Fluid,
        name: 'Engine oil',
        normalizedCategory: MaintenanceCategory.EngineOil,
        quantity: new Prisma.Decimal(3.5),
        unit: 'L',
        unitPrice: new Prisma.Decimal(400),
        lineTotal: new Prisma.Decimal(1400),
        brand: 'Shell',
        partNumber: null,
        notes: 'Fully synthetic',
        position: 0,
        metadata: { grade: '5W-30' },
        createdAt,
        updatedAt: createdAt,
      },
    ],
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
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'vehicle-1',
      odometer: 12345,
    });
    storageService.deleteObject.mockResolvedValue('deleted');
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
        invoiceNumber: undefined,
        currencyCode: undefined,
        source: undefined,
        status: undefined,
        totalCost: 2499,
        laborCost: undefined,
        partsCost: undefined,
        fluidsCost: undefined,
        taxCost: undefined,
        discountAmount: undefined,
        notes: 'Changed engine oil',
        metadata: undefined,
        nextDueDate: new Date('2026-06-18T00:00:00.000Z'),
        nextDueOdometer: 18000,
        lineItems: undefined,
      },
      include: {
        lineItems: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    expect(result.totalCost).toBe(2499);
    expect(result.lineItems).toHaveLength(1);
  });

  it('creates an OCR draft record with sensible defaults for upload-first flows', async () => {
    prisma.maintenanceRecord.create = vi.fn().mockResolvedValue({
      ...record,
      category: MaintenanceCategory.Other,
      source: MaintenanceSource.Ocr,
      status: MaintenanceRecordStatus.Draft,
      totalCost: new Prisma.Decimal(0),
      laborCost: null,
      partsCost: null,
      fluidsCost: null,
      taxCost: null,
      discountAmount: null,
      lineItems: [],
    });

    await service.createDraftForVehicle('user-1', 'vehicle-1');

    expect(prisma.maintenanceRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: 'vehicle-1',
        category: MaintenanceCategory.Other,
        odometer: 12345,
        currencyCode: 'INR',
        source: MaintenanceSource.Ocr,
        status: MaintenanceRecordStatus.Draft,
        totalCost: 0,
      }),
      include: {
        lineItems: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  });

  it('creates maintenance records in bulk for import flows', async () => {
    prisma.$transaction = vi.fn().mockResolvedValue([{ id: 'record-1' }, { id: 'record-2' }]);
    prisma.maintenanceRecord.create = vi.fn().mockResolvedValue(record);

    const result = await service.createBulkForVehicle('user-1', 'vehicle-1', [
      {
        category: MaintenanceCategory.EngineOil,
        serviceDate: '2026-03-18T00:00:00.000Z',
        odometer: 12345,
        totalCost: 2499,
      },
      {
        category: MaintenanceCategory.BrakePads,
        serviceDate: '2026-03-20T00:00:00.000Z',
        odometer: 12600,
        totalCost: 3400,
      },
    ]);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result).toEqual({
      count: 2,
    });
  });

  it('persists nested line items and extended maintenance fields', async () => {
    prisma.maintenanceRecord.create = vi.fn().mockResolvedValue(record);

    await service.createForVehicle('user-1', 'vehicle-1', {
      category: MaintenanceCategory.EngineOil,
      serviceDate: '2026-03-18T00:00:00.000Z',
      odometer: 12345,
      workshopName: 'Trusted Garage',
      invoiceNumber: 'INV-2026-001',
      currencyCode: 'INR',
      source: MaintenanceSource.Ocr,
      status: MaintenanceRecordStatus.Draft,
      totalCost: 2499,
      laborCost: 499,
      partsCost: 1800,
      fluidsCost: 200,
      taxCost: 0,
      discountAmount: 0,
      notes: 'Changed engine oil',
      metadata: { advisor: 'Aman' },
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Fluid,
          name: 'Engine oil',
          normalizedCategory: MaintenanceCategory.EngineOil,
          quantity: 3.5,
          unit: 'L',
          unitPrice: 400,
          lineTotal: 1400,
          brand: 'Shell',
          notes: 'Fully synthetic',
          metadata: { grade: '5W-30' },
        },
      ],
    });

    expect(prisma.maintenanceRecord.create).toHaveBeenCalledWith({
      data: {
        vehicleId: 'vehicle-1',
        category: MaintenanceCategory.EngineOil,
        serviceDate: new Date('2026-03-18T00:00:00.000Z'),
        odometer: 12345,
        workshopName: 'Trusted Garage',
        invoiceNumber: 'INV-2026-001',
        currencyCode: 'INR',
        source: MaintenanceSource.Ocr,
        status: MaintenanceRecordStatus.Draft,
        totalCost: 2499,
        laborCost: 499,
        partsCost: 1800,
        fluidsCost: 200,
        taxCost: 0,
        discountAmount: 0,
        notes: 'Changed engine oil',
        metadata: { advisor: 'Aman' },
        nextDueDate: undefined,
        nextDueOdometer: undefined,
        lineItems: {
          create: [
            {
              kind: MaintenanceLineItemKind.Fluid,
              name: 'Engine oil',
              normalizedCategory: MaintenanceCategory.EngineOil,
              quantity: 3.5,
              unit: 'L',
              unitPrice: 400,
              lineTotal: 1400,
              brand: 'Shell',
              partNumber: undefined,
              notes: 'Fully synthetic',
              position: 0,
              metadata: { grade: '5W-30' },
            },
          ],
        },
      },
      include: {
        lineItems: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  });

  it('replaces line items when updating a maintenance record', async () => {
    prisma.maintenanceRecord.findFirst = vi.fn().mockResolvedValue(record);
    prisma.maintenanceRecord.update = vi.fn().mockResolvedValue({
      ...record,
      lineItems: [],
    });

    await service.updateRecord('user-1', 'record-1', {
      lineItems: [],
      status: MaintenanceRecordStatus.Confirmed,
    });

    expect(prisma.maintenanceRecord.update).toHaveBeenCalledWith({
      where: {
        id: 'record-1',
      },
      data: {
        category: undefined,
        serviceDate: undefined,
        odometer: undefined,
        workshopName: undefined,
        invoiceNumber: undefined,
        currencyCode: undefined,
        source: undefined,
        status: MaintenanceRecordStatus.Confirmed,
        totalCost: undefined,
        laborCost: undefined,
        partsCost: undefined,
        fluidsCost: undefined,
        taxCost: undefined,
        discountAmount: undefined,
        notes: undefined,
        metadata: undefined,
        nextDueDate: undefined,
        nextDueOdometer: undefined,
        lineItems: {
          deleteMany: {},
        },
      },
      include: {
        lineItems: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
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
