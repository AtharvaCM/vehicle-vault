import {
  AttachmentKind,
  FuelType,
  MaintenanceCategory,
  ReminderStatus,
  ReminderType,
  VehicleType,
} from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
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
  const forecastService = {
    getUpcomingSuggestions: vi.fn(),
  };

  let service: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DashboardService(
      vehiclesService as never,
      maintenanceService as never,
      remindersService as never,
      attachmentsService as never,
      forecastService as never,
    );
  });

  it('aggregates counts and recent activity from user-scoped services', async () => {
    vehiclesService.getAllVehicles.mockResolvedValue([
      {
        id: 'vehicle-1',
        registrationNumber: 'MH12AB1234',
        make: 'Hyundai',
        model: 'Creta',
        variant: 'SX',
        year: 2022,
        fuelType: FuelType.Petrol,
        odometer: 12000,
        vehicleType: VehicleType.Car,
        nickname: 'Family car',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    ]);
    maintenanceService.getAllRecords.mockResolvedValue([
      {
        id: 'record-1',
        vehicleId: 'vehicle-1',
        category: MaintenanceCategory.EngineOil,
        serviceDate: '2026-03-18T00:00:00.000Z',
        odometer: 12000,
        workshopName: 'Trusted Garage',
        totalCost: 2499,
        notes: undefined,
        nextDueDate: undefined,
        nextDueOdometer: undefined,
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z',
      },
    ]);
    remindersService.getAllReminders.mockResolvedValue([
      {
        id: 'reminder-1',
        vehicleId: 'vehicle-1',
        title: 'Insurance renewal',
        type: ReminderType.Insurance,
        dueDate: '2026-03-19T00:00:00.000Z',
        dueOdometer: undefined,
        status: ReminderStatus.Overdue,
        completedAt: undefined,
        notes: undefined,
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-19T00:00:00.000Z',
      },
      {
        id: 'reminder-2',
        vehicleId: 'vehicle-1',
        title: 'Service due',
        type: ReminderType.Service,
        dueDate: '2026-03-21T00:00:00.000Z',
        dueOdometer: undefined,
        status: ReminderStatus.Upcoming,
        completedAt: undefined,
        notes: undefined,
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    ]);
    attachmentsService.listAllAttachments.mockResolvedValue([
      {
        id: 'attachment-1',
        maintenanceRecordId: 'record-1',
        kind: AttachmentKind.Document,
        fileName: 'stored-receipt.pdf',
        originalFileName: 'receipt.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        url: '/api/attachments/attachment-1/file',
        uploadedAt: '2026-03-18T00:00:00.000Z',
      },
    ]);
    forecastService.getUpcomingSuggestions.mockResolvedValue([]);

    const result = await service.getSummary('user-1');

    expect(result.totalVehicles).toBe(1);
    expect(result.totalMaintenanceRecords).toBe(1);
    expect(result.totalAttachments).toBe(1);
    expect(result.reminderCounts).toEqual({
      overdue: 1,
      dueToday: 0,
      upcoming: 1,
      completed: 0,
    });
    expect(result.recentVehicles[0]?.displayName).toBe('Family car');
    expect(result.recentMaintenance[0]?.attachmentCount).toBe(1);
    expect(result.overdueReminders[0]?.id).toBe('reminder-1');
    expect(result.upcomingReminders[0]?.id).toBe('reminder-2');
  });
});
