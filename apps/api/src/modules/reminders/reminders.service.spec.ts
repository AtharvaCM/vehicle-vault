import { NotFoundException } from '@nestjs/common';
import { ReminderStatus, ReminderType } from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  type ReminderDelegateMock = {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    reminder: ReminderDelegateMock;
  };

  const createdAt = new Date('2026-03-20T00:00:00.000Z');

  const prisma: PrismaMock = {
    reminder: {
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
      odometer: 12000,
    }),
  };

  let service: RemindersService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T09:00:00.000Z'));
    vehiclesService.ensureVehicleExists.mockResolvedValue({
      id: 'vehicle-1',
      odometer: 12000,
    });
    service = new RemindersService(prisma, vehiclesService as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates reminders with overdue status when the due date is already past', async () => {
    prisma.reminder.create = vi.fn().mockResolvedValue({
      id: 'reminder-1',
      vehicleId: 'vehicle-1',
      title: 'Insurance renewal',
      type: ReminderType.Insurance,
      dueDate: new Date('2026-03-19T00:00:00.000Z'),
      dueOdometer: null,
      status: ReminderStatus.Overdue,
      completedAt: null,
      notes: null,
      createdAt,
      updatedAt: createdAt,
      vehicle: {
        odometer: 12000,
      },
    });
    prisma.reminder.findFirst = vi.fn().mockResolvedValue({
      id: 'reminder-1',
      vehicleId: 'vehicle-1',
      title: 'Insurance renewal',
      type: ReminderType.Insurance,
      dueDate: new Date('2026-03-19T00:00:00.000Z'),
      dueOdometer: null,
      status: ReminderStatus.Overdue,
      completedAt: null,
      notes: null,
      createdAt,
      updatedAt: createdAt,
      vehicle: {
        odometer: 12000,
      },
    });

    const result = await service.createReminder('user-1', 'vehicle-1', {
      title: 'Insurance renewal',
      type: ReminderType.Insurance,
      dueDate: '2026-03-19T00:00:00.000Z',
    });

    expect(prisma.reminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: ReminderStatus.Overdue,
      }),
    });
    expect(result.status).toBe(ReminderStatus.Overdue);
  });

  it('uses vehicle odometer to mark reminders due today', async () => {
    prisma.reminder.create = vi.fn().mockResolvedValue({
      id: 'reminder-2',
      vehicleId: 'vehicle-1',
      title: 'Service due',
      type: ReminderType.Service,
      dueDate: null,
      dueOdometer: 12000,
      status: ReminderStatus.DueToday,
      completedAt: null,
      notes: null,
      createdAt,
      updatedAt: createdAt,
      vehicle: {
        odometer: 12000,
      },
    });
    prisma.reminder.findFirst = vi.fn().mockResolvedValue({
      id: 'reminder-2',
      vehicleId: 'vehicle-1',
      title: 'Service due',
      type: ReminderType.Service,
      dueDate: null,
      dueOdometer: 12000,
      status: ReminderStatus.DueToday,
      completedAt: null,
      notes: null,
      createdAt,
      updatedAt: createdAt,
      vehicle: {
        odometer: 12000,
      },
    });

    const result = await service.createReminder('user-1', 'vehicle-1', {
      title: 'Service due',
      type: ReminderType.Service,
      dueOdometer: 12000,
    });

    expect(result.status).toBe(ReminderStatus.DueToday);
  });

  it('marks a reminder as completed', async () => {
    prisma.reminder.findFirst = vi.fn().mockResolvedValue({
      id: 'reminder-3',
      vehicleId: 'vehicle-1',
      title: 'Battery check',
      type: ReminderType.Battery,
      dueDate: null,
      dueOdometer: 15000,
      status: ReminderStatus.Upcoming,
      completedAt: null,
      notes: null,
      createdAt,
      updatedAt: createdAt,
      vehicle: {
        odometer: 12000,
      },
    });
    prisma.reminder.update = vi.fn().mockResolvedValue(undefined);

    await service.completeReminder('user-1', 'reminder-3');

    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: {
        id: 'reminder-3',
      },
      data: expect.objectContaining({
        status: ReminderStatus.Completed,
        completedAt: expect.any(Date),
      }),
    });
  });

  it('filters and paginates reminders by status', async () => {
    prisma.reminder.findMany = vi.fn().mockResolvedValue([
      {
        id: 'overdue-1',
        vehicleId: 'vehicle-1',
        title: 'Overdue',
        type: ReminderType.Service,
        dueDate: new Date('2026-03-19T00:00:00.000Z'),
        dueOdometer: null,
        status: ReminderStatus.Upcoming,
        completedAt: null,
        notes: null,
        createdAt,
        updatedAt: createdAt,
        vehicle: {
          odometer: 12000,
        },
      },
      {
        id: 'upcoming-1',
        vehicleId: 'vehicle-1',
        title: 'Upcoming',
        type: ReminderType.Service,
        dueDate: new Date('2026-03-25T00:00:00.000Z'),
        dueOdometer: null,
        status: ReminderStatus.Upcoming,
        completedAt: null,
        notes: null,
        createdAt,
        updatedAt: createdAt,
        vehicle: {
          odometer: 12000,
        },
      },
    ]);

    const result = await service.listReminders('user-1', {
      page: 1,
      limit: 10,
      status: ReminderStatus.Overdue,
    });

    expect(result.meta.total).toBe(1);
    expect(result.data[0]?.id).toBe('overdue-1');
  });

  it('returns not found for reminders outside the user scope', async () => {
    prisma.reminder.findFirst = vi.fn().mockResolvedValue(null);

    await expect(service.getReminderById('user-1', 'missing-reminder')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
