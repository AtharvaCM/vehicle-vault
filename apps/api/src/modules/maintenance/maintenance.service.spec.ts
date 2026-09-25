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
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };
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
    vehicle: { findUnique: ReturnType<typeof vi.fn> };
    reminder: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
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
    vehicle: { findUnique: vi.fn() },
    reminder: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
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

  const auditService = {
    track: vi.fn().mockResolvedValue(undefined),
  };

  const reminders = {
    prepareCompletionByRecord: vi.fn(),
    completeByRecord: vi.fn().mockResolvedValue(undefined),
    clearAlertsFor: vi.fn().mockResolvedValue(undefined),
  };

  let service: MaintenanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    reminders.completeByRecord.mockResolvedValue(undefined);
    reminders.clearAlertsFor.mockResolvedValue(undefined);
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'vehicle-1',
      odometer: 12345,
    });
    storageService.deleteObject.mockResolvedValue('deleted');
    auditService.track.mockResolvedValue(undefined);
    // The vehicle the next-due reminder lands on, and no reminder made from this record yet.
    prisma.vehicle.findUnique.mockResolvedValue({ odometer: 12345, userId: 'owner-1' });
    prisma.reminder.findUnique.mockResolvedValue(null);
    prisma.reminder.findMany.mockResolvedValue([]);
    prisma.reminder.create.mockImplementation(async ({ data }) => ({ id: 'reminder-1', ...data }));
    prisma.reminder.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    prisma.$transaction = vi.fn().mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => unknown)(prisma);
      }
      return Array.isArray(arg) ? arg : undefined;
    });
    service = new MaintenanceService(
      prisma as never,
      vehiclesService as never,
      storageService as never,
      auditService as never,
      { assert: vi.fn(), assertEditor: vi.fn(), assertOwner: vi.fn(), resolve: vi.fn() } as never,
      {
        suggestCategory: vi.fn().mockResolvedValue(null),
        searchByPrefix: vi.fn().mockResolvedValue([]),
        recordObservation: vi.fn().mockResolvedValue(undefined),
      } as never,
      productEvents as never,
      reminders as never,
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

  it('serializes an uncategorized line item as undefined rather than null', async () => {
    // Prisma returns null for the unset column. Emitting that null violates the shared
    // schema, which marks the field optional and not nullable — and it fails validation
    // in the edit form, blocking a save on any line item without a mapped category.
    prisma.$transaction = vi.fn().mockResolvedValue([
      [
        {
          ...record,
          lineItems: [{ ...record.lineItems[0], normalizedCategory: null }],
        },
      ],
      1,
    ]);

    const result = await service.listForVehicle('user-1', 'vehicle-1', { page: 1, limit: 20 });
    const lineItem = result.data[0]!.lineItems![0]!;

    expect(lineItem.normalizedCategory).toBeUndefined();
    expect('normalizedCategory' in lineItem && lineItem.normalizedCategory === null).toBe(false);
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

  it('resolves a line item total from quantity x unit price when it was not sent', async () => {
    // Defends the API independently of the web form: any client (bulk import,
    // a future consumer) can send a null lineTotal alongside quantity and
    // unit price, and the record page must not render that as ₹0.
    prisma.maintenanceRecord.create = vi.fn().mockResolvedValue(record);

    await service.createForVehicle('user-1', 'vehicle-1', {
      category: MaintenanceCategory.EngineOil,
      serviceDate: '2026-03-18T00:00:00.000Z',
      odometer: 12345,
      totalCost: 1575,
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Fluid,
          name: 'Engine oil',
          quantity: 3.5,
          unitPrice: 450,
        },
      ],
    });

    expect(prisma.maintenanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lineItems: {
            create: [
              expect.objectContaining({
                name: 'Engine oil',
                quantity: 3.5,
                unitPrice: 450,
                lineTotal: 1575,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('resolves a line item total from quantity x unit price when updating a record', async () => {
    prisma.maintenanceRecord.findFirst = vi.fn().mockResolvedValue(record);
    prisma.maintenanceRecord.update = vi.fn().mockResolvedValue(record);

    await service.updateRecord('user-1', 'record-1', {
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Part,
          name: 'Oil filter',
          quantity: 2,
          unitPrice: 225,
        },
      ],
    });

    expect(prisma.maintenanceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lineItems: expect.objectContaining({
            create: [
              expect.objectContaining({
                name: 'Oil filter',
                quantity: 2,
                unitPrice: 225,
                lineTotal: 450,
              }),
            ],
          }),
        }),
      }),
    );
  });

  it('leaves a line item total undefined when neither typed nor derivable', async () => {
    prisma.maintenanceRecord.create = vi.fn().mockResolvedValue(record);

    await service.createForVehicle('user-1', 'vehicle-1', {
      category: MaintenanceCategory.EngineOil,
      serviceDate: '2026-03-18T00:00:00.000Z',
      odometer: 12345,
      totalCost: 0,
      lineItems: [
        {
          kind: MaintenanceLineItemKind.Job,
          name: 'Inspection',
        },
      ],
    });

    expect(prisma.maintenanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lineItems: {
            create: [expect.objectContaining({ name: 'Inspection', lineTotal: undefined })],
          },
        }),
      }),
    );
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
  describe('the reminder a logged service answers (`reminderId`)', () => {
    const handoff = { before: { id: 'reminder-due' }, next: null, now: new Date() };
    const input = {
      category: MaintenanceCategory.EngineOil,
      serviceDate: '2026-03-18T00:00:00.000Z',
      odometer: 12345,
      totalCost: 2499,
      reminderId: '0d3f9a52-8f4e-4c1f-9d55-3f2c7b9e1a20',
    };

    it('completes it in the record’s transaction, counted from the record', async () => {
      prisma.maintenanceRecord.create = vi.fn().mockResolvedValue(record);
      reminders.prepareCompletionByRecord.mockResolvedValue(handoff);

      await service.createForVehicle('user-1', 'vehicle-1', input);

      expect(reminders.prepareCompletionByRecord).toHaveBeenCalledWith(
        'user-1',
        'vehicle-1',
        input.reminderId,
        { serviceDate: new Date('2026-03-18T00:00:00.000Z'), odometer: 12345 },
      );
      expect(reminders.completeByRecord).toHaveBeenCalledWith(prisma, 'user-1', handoff, record);
      expect(reminders.clearAlertsFor).toHaveBeenCalledWith('user-1', 'reminder-due');
      // The link is not a column on the record.
      expect(prisma.maintenanceRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ reminderId: expect.anything() }),
        }),
      );
    });

    it('leaves the reminder open while the record is only a draft', async () => {
      prisma.maintenanceRecord.create = vi.fn().mockResolvedValue({
        ...record,
        status: MaintenanceRecordStatus.Draft,
      });

      await service.createForVehicle('user-1', 'vehicle-1', {
        ...input,
        status: MaintenanceRecordStatus.Draft,
      });

      expect(reminders.prepareCompletionByRecord).not.toHaveBeenCalled();
      expect(reminders.completeByRecord).not.toHaveBeenCalled();
    });

    it('completes it when the draft is confirmed from the edit form', async () => {
      prisma.maintenanceRecord.findFirst = vi.fn().mockResolvedValue({
        ...record,
        status: MaintenanceRecordStatus.Draft,
      });
      prisma.maintenanceRecord.update = vi.fn().mockResolvedValue(record);
      reminders.prepareCompletionByRecord.mockResolvedValue(handoff);

      await service.updateRecord('user-1', 'record-1', {
        status: MaintenanceRecordStatus.Confirmed,
        reminderId: input.reminderId,
      });

      expect(reminders.prepareCompletionByRecord).toHaveBeenCalledWith(
        'user-1',
        'vehicle-1',
        input.reminderId,
        { serviceDate: record.serviceDate, odometer: record.odometer },
      );
      expect(reminders.completeByRecord).toHaveBeenCalledWith(prisma, 'user-1', handoff, record);
    });

    it('does nothing more when the reminder was already complete', async () => {
      prisma.maintenanceRecord.create = vi.fn().mockResolvedValue(record);
      reminders.prepareCompletionByRecord.mockResolvedValue(null);

      await service.createForVehicle('user-1', 'vehicle-1', input);

      expect(reminders.completeByRecord).not.toHaveBeenCalled();
      expect(reminders.clearAlertsFor).not.toHaveBeenCalled();
    });
  });

  describe('the reminder a confirmed service leaves behind', () => {
    const createInput = {
      category: MaintenanceCategory.EngineOil,
      serviceDate: '2026-03-18T00:00:00.000Z',
      odometer: 12345,
      workshopName: 'Trusted Garage',
      totalCost: 2499,
      nextDueDate: '2026-06-18T00:00:00.000Z',
      nextDueOdometer: 18000,
    };

    it('turns what the workshop wrote down into a reminder on the vehicle', async () => {
      prisma.maintenanceRecord.create = vi.fn().mockResolvedValue(record);

      await service.createForVehicle('user-1', 'vehicle-1', createInput);

      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: {
          vehicleId: 'vehicle-1',
          sourceMaintenanceRecordId: 'record-1',
          title: 'Engine oil due',
          type: 'service',
          dueDate: new Date('2026-06-18T00:00:00.000Z'),
          dueOdometer: 18000,
          notes: 'Set at the service at Trusted Garage on 18 Mar 2026.',
          // Worked out like any reminder's: 18 Jun 2026 has already passed.
          status: 'overdue',
        },
      });
      expect(auditService.track).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'reminder.created',
          resourceId: 'reminder-1',
          ownerUserId: 'owner-1',
        }),
      );
    });

    it('refreshes the same reminder when the record is edited, instead of adding one', async () => {
      prisma.maintenanceRecord.findFirst = vi.fn().mockResolvedValue(record);
      prisma.maintenanceRecord.update = vi.fn().mockResolvedValue({
        ...record,
        nextDueOdometer: 19000,
      });
      const existing = {
        id: 'reminder-1',
        sourceMaintenanceRecordId: 'record-1',
        completedAt: null,
        dueOdometer: 18000,
      };
      prisma.reminder.findUnique.mockResolvedValue(existing);

      await service.updateRecord('user-1', 'record-1', { nextDueOdometer: 19000 });

      expect(prisma.reminder.findUnique).toHaveBeenCalledWith({
        where: { sourceMaintenanceRecordId: 'record-1' },
      });
      expect(prisma.reminder.create).not.toHaveBeenCalled();
      expect(prisma.reminder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reminder-1' },
          data: expect.objectContaining({ dueOdometer: 19000 }),
        }),
      );
      expect(auditService.track).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'reminder.updated', resourceId: 'reminder-1' }),
      );
    });

    it('leaves alone a reminder the owner has already completed', async () => {
      prisma.maintenanceRecord.findFirst = vi.fn().mockResolvedValue(record);
      prisma.maintenanceRecord.update = vi.fn().mockResolvedValue(record);
      prisma.reminder.findUnique.mockResolvedValue({
        id: 'reminder-1',
        completedAt: new Date('2026-06-20T00:00:00.000Z'),
      });

      await service.updateRecord('user-1', 'record-1', { notes: 'Receipt re-read' });

      expect(prisma.reminder.update).not.toHaveBeenCalled();
      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('makes nothing from a record with neither a next-due date nor odometer', async () => {
      prisma.maintenanceRecord.create = vi.fn().mockResolvedValue({
        ...record,
        nextDueDate: null,
        nextDueOdometer: null,
      });

      await service.createForVehicle('user-1', 'vehicle-1', {
        ...createInput,
        nextDueDate: undefined,
        nextDueOdometer: undefined,
      });

      expect(prisma.reminder.findUnique).not.toHaveBeenCalled();
      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('waits for a draft to be confirmed', async () => {
      prisma.maintenanceRecord.create = vi.fn().mockResolvedValue({
        ...record,
        status: MaintenanceRecordStatus.Draft,
      });

      await service.createForVehicle('user-1', 'vehicle-1', {
        ...createInput,
        status: MaintenanceRecordStatus.Draft,
      });

      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('takes only the newest of each kind from an import, not every old row', async () => {
      let next = 0;
      prisma.maintenanceRecord.create = vi.fn().mockImplementation(async ({ data }) => ({
        ...record,
        id: `imported-${++next}`,
        category: data.category,
        serviceDate: new Date(data.serviceDate),
        status: MaintenanceRecordStatus.Confirmed,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
        nextDueOdometer: data.nextDueOdometer ?? null,
        lineItems: [],
      }));
      prisma.$transaction = vi
        .fn()
        .mockImplementation((arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (tx: unknown) => unknown)(prisma)
            : Promise.all(arg as Promise<unknown>[]),
        );

      await service.createBulkForVehicle('user-1', 'vehicle-1', [
        {
          category: MaintenanceCategory.EngineOil,
          serviceDate: '2025-03-18T00:00:00.000Z',
          odometer: 5000,
          totalCost: 2000,
          nextDueDate: '2025-09-18T00:00:00.000Z',
        },
        {
          category: MaintenanceCategory.EngineOil,
          serviceDate: '2026-03-18T00:00:00.000Z',
          odometer: 12000,
          totalCost: 2499,
          nextDueOdometer: 17000,
        },
        {
          category: MaintenanceCategory.BrakePads,
          serviceDate: '2026-03-20T00:00:00.000Z',
          odometer: 12100,
          totalCost: 3400,
        },
      ]);

      // One reminder, from the 2026 oil change: the 2025 one's date is long gone,
      // and the brake pads carried no next-due at all.
      expect(prisma.reminder.create).toHaveBeenCalledTimes(1);
      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceMaintenanceRecordId: 'imported-2',
          dueOdometer: 17000,
        }),
      });
    });

    it('fulfils the reminder an earlier service of the same kind left open', async () => {
      prisma.maintenanceRecord.create = vi.fn().mockResolvedValue(record);
      const earlier = { id: 'reminder-old', completedAt: null };
      prisma.reminder.findMany.mockResolvedValue([earlier]);

      await service.createForVehicle('user-1', 'vehicle-1', createInput);

      expect(prisma.reminder.findMany).toHaveBeenCalledWith({
        where: {
          vehicleId: 'vehicle-1',
          id: { not: 'reminder-1' },
          completedAt: null,
          sourceMaintenanceRecord: {
            category: MaintenanceCategory.EngineOil,
            serviceDate: { lt: serviceDate },
          },
        },
      });
      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder-old' },
        data: { completedAt: expect.any(Date), status: 'completed' },
      });
      expect(auditService.track).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'reminder.completed', resourceId: 'reminder-old' }),
      );
    });

    it('confirms a scanned draft from the edit form: logs the service and makes its reminder', async () => {
      const draft = {
        ...record,
        source: MaintenanceSource.Ocr,
        status: MaintenanceRecordStatus.Draft,
      };
      prisma.maintenanceRecord.findFirst = vi.fn().mockResolvedValue(draft);
      prisma.maintenanceRecord.update = vi.fn().mockResolvedValue(record);

      // What the edit page sends when its button reads "Confirm Record": the
      // reviewed fields, plus the status the draft never had.
      await service.updateRecord('user-1', 'record-1', {
        ...createInput,
        status: MaintenanceRecordStatus.Confirmed,
      });

      expect(prisma.maintenanceRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'record-1' },
          data: expect.objectContaining({ status: MaintenanceRecordStatus.Confirmed }),
        }),
      );
      expect(productEvents.recordFirst).toHaveBeenCalledWith(prisma, {
        name: 'first_maintenance_logged',
        userId: 'user-1',
        vehicleId: 'vehicle-1',
      });
      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceMaintenanceRecordId: 'record-1',
          dueDate: new Date('2026-06-18T00:00:00.000Z'),
          dueOdometer: 18000,
        }),
      });
      // The record's own audit carries the confirmation, like any other edit.
      expect(auditService.track).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'maintenance.updated',
          resourceId: 'record-1',
          before: expect.objectContaining({ status: MaintenanceRecordStatus.Draft }),
          after: expect.objectContaining({ status: MaintenanceRecordStatus.Confirmed }),
        }),
      );
    });
  });
});

describe('MaintenanceService first_maintenance_logged', () => {
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };
  const at = new Date('2026-03-18T00:00:00.000Z');
  const confirmed = {
    id: 'record-1',
    vehicleId: 'vehicle-1',
    category: MaintenanceCategory.EngineOil,
    serviceDate: at,
    odometer: 12345,
    workshopName: null,
    invoiceNumber: null,
    currencyCode: 'INR',
    source: MaintenanceSource.Manual,
    status: MaintenanceRecordStatus.Confirmed,
    totalCost: new Prisma.Decimal(2499),
    laborCost: null,
    partsCost: null,
    fluidsCost: null,
    taxCost: null,
    discountAmount: null,
    notes: null,
    metadata: null,
    nextDueDate: null,
    nextDueOdometer: null,
    createdAt: at,
    updatedAt: at,
    lineItems: [],
  };
  const draft = { ...confirmed, status: MaintenanceRecordStatus.Draft };

  /** The transaction client the callback receives — what the event must be written through. */
  const tx = { marker: 'tx' };
  const prisma = {
    $transaction: vi.fn(),
    maintenanceRecord: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };

  const build = () =>
    new MaintenanceService(
      prisma as never,
      {
        ensureVehicleExists: vi.fn().mockResolvedValue({ id: 'vehicle-1', odometer: 12345 }),
      } as never,
      {} as never,
      { track: vi.fn().mockResolvedValue(undefined) } as never,
      { assert: vi.fn(), assertEditor: vi.fn(), assertOwner: vi.fn(), resolve: vi.fn() } as never,
      {
        suggestCategory: vi.fn().mockResolvedValue(null),
        searchByPrefix: vi.fn().mockResolvedValue([]),
        recordObservation: vi.fn().mockResolvedValue(undefined),
      } as never,
      productEvents as never,
    );

  const payload = {
    category: MaintenanceCategory.EngineOil,
    serviceDate: '2026-03-18T00:00:00.000Z',
    odometer: 12345,
    totalCost: 2499,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(tx, { maintenanceRecord: prisma.maintenanceRecord });
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: unknown) => unknown)(tx)
        : Promise.resolve((arg as unknown[]).map(() => confirmed)),
    );
  });

  it('is recorded inside the create transaction for a confirmed record', async () => {
    prisma.maintenanceRecord.create.mockResolvedValue(confirmed);

    await build().createForVehicle('user-1', 'vehicle-1', payload);

    expect(productEvents.recordFirst).toHaveBeenCalledWith(tx, {
      name: 'first_maintenance_logged',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
    });
  });

  it('is not recorded for a draft, which is not yet a service anyone agreed happened', async () => {
    prisma.maintenanceRecord.create.mockResolvedValue(draft);

    await build().createForVehicle('user-1', 'vehicle-1', {
      ...payload,
      status: MaintenanceRecordStatus.Draft,
    });

    expect(productEvents.recordFirst).not.toHaveBeenCalled();
  });

  it('is recorded when a draft is confirmed', async () => {
    prisma.maintenanceRecord.findFirst.mockResolvedValue(draft);
    prisma.maintenanceRecord.update.mockResolvedValue(confirmed);

    await build().updateRecord('user-1', 'record-1', { status: MaintenanceRecordStatus.Confirmed });

    expect(productEvents.recordFirst).toHaveBeenCalledWith(tx, {
      name: 'first_maintenance_logged',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
    });
  });

  it('is not recorded for an edit to a record that was already confirmed', async () => {
    prisma.maintenanceRecord.findFirst.mockResolvedValue(confirmed);
    prisma.maintenanceRecord.update.mockResolvedValue(confirmed);

    await build().updateRecord('user-1', 'record-1', { notes: 'typo fixed' });

    expect(productEvents.recordFirst).not.toHaveBeenCalled();
  });

  it('joins the bulk import batch when any imported record is confirmed', async () => {
    const service = build();

    await service.createBulkForVehicle('user-1', 'vehicle-1', [
      payload,
      { ...payload, status: MaintenanceRecordStatus.Draft },
    ]);

    const batch = prisma.$transaction.mock.calls[0][0] as unknown[];
    expect(batch).toHaveLength(3);
    expect(productEvents.recordFirst).toHaveBeenCalledWith(prisma, {
      name: 'first_maintenance_logged',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
    });
  });

  it('adds nothing to the batch when every imported record is a draft', async () => {
    await build().createBulkForVehicle('user-1', 'vehicle-1', [
      { ...payload, status: MaintenanceRecordStatus.Draft },
    ]);

    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(1);
    expect(productEvents.recordFirst).not.toHaveBeenCalled();
  });
});
