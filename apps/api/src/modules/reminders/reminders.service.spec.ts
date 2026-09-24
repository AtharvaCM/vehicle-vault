import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReminderStatus, ReminderType } from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };
  type ReminderDelegateMock = {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    $transaction: ReturnType<typeof vi.fn>;
    reminder: ReminderDelegateMock;
    fuelLog: { findMany: ReturnType<typeof vi.fn> };
  };

  const createdAt = new Date('2026-03-20T00:00:00.000Z');

  const prisma: PrismaMock = {
    $transaction: vi.fn(),
    reminder: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      // Renewal linking reads the reminder back; null means nothing to link.
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    fuelLog: { findMany: vi.fn().mockResolvedValue([]) },
  };

  const vehiclesService = {
    ensureVehicleExists: vi.fn().mockResolvedValue({
      id: 'vehicle-1',
      odometer: 12000,
    }),
  };

  const auditService = {
    track: vi.fn().mockResolvedValue(undefined),
  };

  const notificationsService = {
    markReadForReminder: vi.fn().mockResolvedValue(undefined),
  };
  const serviceScheduleService = { buildNextOccurrence: vi.fn() };

  const access = {
    assert: vi.fn(),
    assertEditor: vi.fn(),
    assertOwner: vi.fn(),
    resolve: vi.fn(),
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
    auditService.track.mockResolvedValue(undefined);
    notificationsService.markReadForReminder.mockResolvedValue(undefined);
    prisma.fuelLog.findMany.mockResolvedValue([]);
    prisma.$transaction = vi.fn().mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => unknown)(prisma);
      }
      return Array.isArray(arg) ? arg : undefined;
    });
    serviceScheduleService.buildNextOccurrence.mockResolvedValue(null);
    service = new RemindersService(
      prisma as never,
      vehiclesService as never,
      auditService as never,
      access as never,
      notificationsService as never,
      serviceScheduleService as never,
      productEvents as never,
    );
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
    expect(productEvents.record).toHaveBeenCalledWith(prisma, {
      name: 'reminder_created',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
      properties: { source: 'manual' },
    });
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
    expect(notificationsService.markReadForReminder).toHaveBeenCalledWith('user-1', 'reminder-3');
  });

  describe('recurring reminders', () => {
    const catalogReminder = {
      id: 'reminder-4',
      vehicleId: 'vehicle-1',
      title: 'Engine oil change',
      type: ReminderType.Service,
      dueDate: null,
      dueOdometer: 15000,
      status: ReminderStatus.Upcoming,
      completedAt: null,
      notes: 'Every 10 000 km.',
      catalogSlug: 'engine_oil_change',
      repeatEveryKm: 10000,
      repeatEveryMonths: 12,
      createdAt,
      updatedAt: createdAt,
      vehicle: { odometer: 12000 },
    };

    beforeEach(() => {
      prisma.reminder.findFirst = vi.fn().mockResolvedValue(catalogReminder);
      prisma.reminder.update = vi.fn().mockResolvedValue(undefined);
      prisma.reminder.create = vi.fn().mockResolvedValue({ id: 'reminder-next' });
    });

    it('schedules the next occurrence when a catalog reminder is completed', async () => {
      // The gap this closes: an interval that stopped meaning anything the
      // first time somebody acted on it.
      serviceScheduleService.buildNextOccurrence.mockResolvedValue({
        vehicleId: 'vehicle-1',
        title: 'Engine oil change',
        type: ReminderType.Service,
        dueOdometer: 22000,
        dueDate: null,
        catalogSlug: 'engine_oil_change',
        status: ReminderStatus.Upcoming,
      });

      await service.completeReminder('user-1', 'reminder-4');

      // The stored reminder, whose id keeps it from counting as its own
      // successor and whose repeat rule decides the next one.
      expect(serviceScheduleService.buildNextOccurrence).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          id: 'reminder-4',
          catalogSlug: 'engine_oil_change',
          repeatEveryKm: 10000,
        }),
        expect.any(Date),
      );
      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ dueOdometer: 22000 }),
      });
    });

    it('records the scheduled reminder as its own audited creation', async () => {
      serviceScheduleService.buildNextOccurrence.mockResolvedValue({
        vehicleId: 'vehicle-1',
        title: 'Engine oil change',
        type: ReminderType.Service,
        dueOdometer: 22000,
        dueDate: null,
        catalogSlug: 'engine_oil_change',
        status: ReminderStatus.Upcoming,
      });

      await service.completeReminder('user-1', 'reminder-4');

      const actions = auditService.track.mock.calls.map(
        ([, event]) => (event as { action: string }).action,
      );
      expect(actions).toEqual(['reminder.completed', 'reminder.created']);
      // Rolled forward by the app, not created by the user: audited, not counted.
      expect(productEvents.record).not.toHaveBeenCalled();
    });

    it('creates nothing when the reminder does not recur', async () => {
      serviceScheduleService.buildNextOccurrence.mockResolvedValue(null);

      await service.completeReminder('user-1', 'reminder-4');

      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('shows a reminder\u2019s origin and repeat rule, with notes as written', async () => {
      const result = await service.getReminderById('user-1', 'reminder-4');

      expect(result).toMatchObject({
        notes: 'Every 10 000 km.',
        catalogSlug: 'engine_oil_change',
        repeatEveryKm: 10000,
        repeatEveryMonths: 12,
      });
    });
  });

  describe('repeat rule on the form', () => {
    it('stores the rule a hand-written reminder is created with', async () => {
      prisma.reminder.create = vi.fn().mockResolvedValue({ id: 'reminder-new' });
      prisma.reminder.findFirst = vi.fn().mockResolvedValue({
        id: 'reminder-new',
        vehicleId: 'vehicle-1',
        title: 'Insurance renewal',
        type: ReminderType.Insurance,
        dueDate: new Date('2027-03-01T00:00:00.000Z'),
        dueOdometer: null,
        status: ReminderStatus.Upcoming,
        completedAt: null,
        notes: null,
        catalogSlug: null,
        repeatEveryMonths: 12,
        repeatEveryKm: null,
        createdAt,
        updatedAt: createdAt,
        vehicle: { odometer: 12000 },
      });

      const result = await service.createReminder('user-1', 'vehicle-1', {
        title: 'Insurance renewal',
        type: ReminderType.Insurance,
        dueDate: '2027-03-01T00:00:00.000Z',
        repeatEveryMonths: 12,
      });

      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ repeatEveryMonths: 12, repeatEveryKm: null }),
      });
      expect(result.repeatEveryMonths).toBe(12);
      expect(result.repeatEveryKm).toBeUndefined();
    });

    it('clears a dimension of the rule with null and leaves an unsent one alone', async () => {
      prisma.reminder.findFirst = vi.fn().mockResolvedValue({
        id: 'reminder-4',
        vehicleId: 'vehicle-1',
        title: 'Engine oil change',
        type: ReminderType.Service,
        dueDate: null,
        dueOdometer: 15000,
        status: ReminderStatus.Upcoming,
        completedAt: null,
        notes: null,
        catalogSlug: 'engine_oil_change',
        repeatEveryMonths: 12,
        repeatEveryKm: 10000,
        createdAt,
        updatedAt: createdAt,
        vehicle: { odometer: 12000 },
      });
      prisma.reminder.update = vi.fn().mockResolvedValue({});

      await service.updateReminder('user-1', 'reminder-4', { repeatEveryMonths: null });

      const [{ data }] = prisma.reminder.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(data.repeatEveryMonths).toBeNull();
      expect(data.repeatEveryKm).toBeUndefined();
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

  describe('snoozeReminder', () => {
    const baseDatedReminder = {
      id: 'reminder-5',
      vehicleId: 'vehicle-1',
      title: 'Insurance renewal',
      type: ReminderType.Insurance,
      dueOdometer: null,
      completedAt: null,
      notes: null,
      catalogSlug: null,
      repeatEveryMonths: null,
      repeatEveryKm: null,
      createdAt,
      updatedAt: createdAt,
      vehicle: { odometer: 12000 },
    };

    const baseOdometerReminder = {
      id: 'reminder-6',
      vehicleId: 'vehicle-1',
      title: 'Engine oil change',
      type: ReminderType.Service,
      dueDate: null,
      completedAt: null,
      notes: null,
      catalogSlug: null,
      repeatEveryMonths: null,
      repeatEveryKm: null,
      createdAt,
      updatedAt: createdAt,
      vehicle: { odometer: 12000 },
    };

    it('moves a past due date to today plus the snooze window', async () => {
      const before = {
        ...baseDatedReminder,
        dueDate: new Date('2026-03-17T00:00:00.000Z'),
        status: ReminderStatus.Overdue,
      };
      const after = {
        ...before,
        dueDate: new Date('2026-03-27T00:00:00.000Z'),
        status: ReminderStatus.Upcoming,
      };
      prisma.reminder.findFirst = vi
        .fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      prisma.reminder.update = vi.fn().mockResolvedValue(after);

      await service.snoozeReminder('user-1', 'reminder-5');

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder-5' },
        data: expect.objectContaining({
          dueDate: new Date('2026-03-27T00:00:00.000Z'),
          status: ReminderStatus.Upcoming,
        }),
      });
    });

    it('moves a future due date seven days past its own date', async () => {
      const before = {
        ...baseDatedReminder,
        dueDate: new Date('2026-04-10T00:00:00.000Z'),
        status: ReminderStatus.Upcoming,
      };
      const after = {
        ...before,
        dueDate: new Date('2026-04-17T00:00:00.000Z'),
        status: ReminderStatus.Upcoming,
      };
      prisma.reminder.findFirst = vi
        .fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      prisma.reminder.update = vi.fn().mockResolvedValue(after);

      await service.snoozeReminder('user-1', 'reminder-5');

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder-5' },
        data: expect.objectContaining({
          dueDate: new Date('2026-04-17T00:00:00.000Z'),
          status: ReminderStatus.Upcoming,
        }),
      });
    });

    it('moves the odometer target past the vehicle odometer or its own target, whichever is further', async () => {
      const before = {
        ...baseOdometerReminder,
        dueOdometer: 11500,
        status: ReminderStatus.Overdue,
      };
      const after = {
        ...before,
        dueOdometer: 12500,
        status: ReminderStatus.Upcoming,
      };
      prisma.reminder.findFirst = vi
        .fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      prisma.reminder.update = vi.fn().mockResolvedValue(after);

      await service.snoozeReminder('user-1', 'reminder-6');

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder-6' },
        data: expect.objectContaining({
          dueDate: null,
          dueOdometer: 12500,
        }),
      });
    });

    it('moves an odometer target already ahead of the vehicle by the snooze distance', async () => {
      const before = {
        ...baseOdometerReminder,
        dueOdometer: 15000,
        status: ReminderStatus.Upcoming,
      };
      const after = {
        ...before,
        dueOdometer: 15500,
      };
      prisma.reminder.findFirst = vi
        .fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      prisma.reminder.update = vi.fn().mockResolvedValue(after);

      await service.snoozeReminder('user-1', 'reminder-6');

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder-6' },
        data: expect.objectContaining({
          dueDate: null,
          dueOdometer: 15500,
        }),
      });
    });

    it('requires editor access to the reminder’s vehicle', async () => {
      const before = {
        ...baseOdometerReminder,
        dueOdometer: 15000,
        status: ReminderStatus.Upcoming,
      };
      const after = { ...before, dueOdometer: 15500 };
      prisma.reminder.findFirst = vi
        .fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      prisma.reminder.update = vi.fn().mockResolvedValue(after);

      await service.snoozeReminder('user-1', 'reminder-6');

      expect(access.assertEditor).toHaveBeenCalledWith('user-1', 'vehicle-1');
    });

    it('refuses to snooze a completed reminder', async () => {
      const before = {
        ...baseDatedReminder,
        dueDate: new Date('2026-03-17T00:00:00.000Z'),
        status: ReminderStatus.Completed,
        completedAt: new Date('2026-03-18T00:00:00.000Z'),
      };
      prisma.reminder.findFirst = vi.fn().mockResolvedValue(before);
      prisma.reminder.update = vi.fn();

      await expect(service.snoozeReminder('user-1', 'reminder-5')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });

    it('audits the snooze as a reminder update and clears its notifications', async () => {
      const before = {
        ...baseOdometerReminder,
        dueOdometer: 15000,
        status: ReminderStatus.Upcoming,
      };
      const after = { ...before, dueOdometer: 15500 };
      prisma.reminder.findFirst = vi
        .fn()
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      prisma.reminder.update = vi.fn().mockResolvedValue(after);

      await service.snoozeReminder('user-1', 'reminder-6');

      expect(auditService.track).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'reminder.updated',
          resourceId: 'reminder-6',
        }),
      );
      expect(notificationsService.markReadForReminder).toHaveBeenCalledWith('user-1', 'reminder-6');
    });

    it('returns not found when the reminder is outside the user scope', async () => {
      prisma.reminder.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.snoozeReminder('user-1', 'missing-reminder')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });
  });
});
