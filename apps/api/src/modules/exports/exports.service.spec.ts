import {
  AttachmentKind,
  FuelType,
  MaintenanceCategory,
  ReminderStatus,
  ReminderType,
  VehicleType,
} from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportsService } from './exports.service';

describe('ExportsService', () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
  };
  const vehiclesService = {
    getAllVehicles: vi.fn(),
  };
  const maintenanceService = {
    getAllRecords: vi.fn(),
  };
  const remindersService = {
    getAllReminders: vi.fn(),
  };
  const attachmentsService = {
    listAllAttachments: vi.fn(),
  };

  let service: ExportsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:15:00.000Z'));
    service = new ExportsService(
      prisma as never,
      vehiclesService as never,
      maintenanceService as never,
      remindersService as never,
      attachmentsService as never,
    );
  });

  it('builds a user-scoped account export and file metadata', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'TechnoWizard',
      email: 'wizard@example.com',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-10T00:00:00.000Z'),
    });
    vehiclesService.getAllVehicles.mockResolvedValue([
      {
        id: 'vehicle-1',
        registrationNumber: 'MH12AB1234',
        make: 'Hyundai',
        model: 'i20',
        variant: 'Asta',
        year: 2023,
        fuelType: FuelType.Petrol,
        odometer: 18000,
        vehicleType: VehicleType.Car,
        nickname: 'Daily',
        createdAt: '2026-03-02T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:00.000Z',
      },
    ]);
    maintenanceService.getAllRecords.mockResolvedValue([
      {
        id: 'record-1',
        vehicleId: 'vehicle-1',
        category: MaintenanceCategory.PeriodicService,
        serviceDate: '2026-03-12T00:00:00.000Z',
        odometer: 18000,
        workshopName: 'Trusted Garage',
        totalCost: 4200,
        notes: 'Periodic service',
        nextDueDate: undefined,
        nextDueOdometer: undefined,
        createdAt: '2026-03-12T00:00:00.000Z',
        updatedAt: '2026-03-12T00:00:00.000Z',
      },
    ]);
    remindersService.getAllReminders.mockResolvedValue([
      {
        id: 'reminder-1',
        vehicleId: 'vehicle-1',
        title: 'Insurance renewal',
        type: ReminderType.Insurance,
        dueDate: '2026-04-01T00:00:00.000Z',
        dueOdometer: undefined,
        status: ReminderStatus.Upcoming,
        completedAt: undefined,
        notes: undefined,
        createdAt: '2026-03-12T00:00:00.000Z',
        updatedAt: '2026-03-12T00:00:00.000Z',
      },
    ]);
    attachmentsService.listAllAttachments.mockResolvedValue([
      {
        id: 'attachment-1',
        maintenanceRecordId: 'record-1',
        kind: AttachmentKind.Document,
        fileName: 'invoice.pdf',
        originalFileName: 'invoice.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        url: '/api/attachments/attachment-1/file',
        uploadedAt: '2026-03-12T00:00:00.000Z',
      },
    ]);

    const result = await service.exportAccount('user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
    });
    expect(result.meta).toEqual({
      format: 'json',
      fileName: 'vehicle-vault-export-2026-03-21.json',
    });
    expect(result.data).toMatchObject({
      version: 1,
      user: {
        id: 'user-1',
        name: 'TechnoWizard',
        email: 'wizard@example.com',
      },
      vehicles: [
        {
          id: 'vehicle-1',
        },
      ],
      maintenanceRecords: [
        {
          id: 'record-1',
        },
      ],
      reminders: [
        {
          id: 'reminder-1',
        },
      ],
      attachments: [
        {
          id: 'attachment-1',
        },
      ],
    });
    expect(result.data.exportedAt).toBe('2026-03-21T10:15:00.000Z');
  });
});
