import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsService } from './notifications.service';
import { NotifyService } from './notify.service';
import { MaintenanceDueTemplate } from './templates/maintenance-due.template';
import { ServiceBaselineUnknownTemplate } from './templates/service-baseline-unknown.template';
import { TyreUninspectedTemplate } from './templates/tyre-uninspected.template';
import type { Channel } from './types';

describe('NotifyService', () => {
  const prisma = {
    notification: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  const okChannel: Channel = {
    name: 'email',
    deliver: vi.fn(),
  };

  const failingChannel: Channel = {
    name: 'sms',
    deliver: vi.fn(),
  };

  const template = new MaintenanceDueTemplate();

  let service: NotifyService;

  const sampleNotification = {
    id: 'notif-1',
    userId: 'user-1',
    vehicleId: 'veh-1',
    kind: 'maintenance-due',
    dedupKey: 'maintenance-due:veh-1:engine_oil',
    title: 'Service Due Soon: Engine Oil',
    message: 'Your Engine Oil is due in approx. 200 km. Time to plan a visit to the workshop.',
    type: 'warning',
    isRead: false,
    link: '/vehicles/veh-1?tab=maintenance',
    createdAt: new Date('2026-05-16T00:00:00.000Z'),
    updatedAt: new Date('2026-05-16T00:00:00.000Z'),
  };

  const sampleUser = {
    id: 'user-1',
    email: 'atharva@example.com',
    name: 'Atharva',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (okChannel.deliver as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (failingChannel.deliver as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    service = new NotifyService(prisma as never, [template] as never, [okChannel]);
  });

  it('renders via template, persists Notification with kind + dedupKey, and dispatches channels', async () => {
    prisma.notification.create.mockResolvedValue(sampleNotification);
    prisma.user.findUnique.mockResolvedValue(sampleUser);

    const result = await service.raise('user-1', 'veh-1', 'maintenance-due', {
      vehicleId: 'veh-1',
      category: 'engine_oil',
      remainingDistanceKm: 200,
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        vehicleId: 'veh-1',
        kind: 'maintenance-due',
        dedupKey: 'maintenance-due:veh-1:engine_oil',
        title: 'Service Due Soon: Engine Oil',
        message: 'Your Engine Oil is due in approx. 200 km. Time to plan a visit to the workshop.',
        type: 'warning',
        link: '/vehicles/veh-1?tab=maintenance',
      },
    });
    expect(okChannel.deliver).toHaveBeenCalledWith(sampleNotification, sampleUser);
    expect(result).toEqual(sampleNotification);
  });

  it('returns the existing unread row on dedup collision (P2002) without re-dispatching channels', async () => {
    prisma.notification.create.mockRejectedValue(
      new PrismaClientKnownRequestError('unique violation', {
        code: 'P2002',
        clientVersion: 'vitest',
      }),
    );
    prisma.notification.findFirst.mockResolvedValue(sampleNotification);

    const result = await service.raise('user-1', 'veh-1', 'maintenance-due', {
      vehicleId: 'veh-1',
      category: 'engine_oil',
      remainingDistanceKm: 100,
    });

    expect(prisma.notification.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        dedupKey: 'maintenance-due:veh-1:engine_oil',
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(okChannel.deliver).not.toHaveBeenCalled();
    expect(result).toEqual(sampleNotification);
  });

  it('does not roll back the Notification row when a channel rejects', async () => {
    prisma.notification.create.mockResolvedValue(sampleNotification);
    prisma.user.findUnique.mockResolvedValue(sampleUser);
    (failingChannel.deliver as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('SMS gateway down'),
    );

    service = new NotifyService(prisma as never, [template] as never, [okChannel, failingChannel]);

    const result = await service.raise('user-1', 'veh-1', 'maintenance-due', {
      vehicleId: 'veh-1',
      category: 'engine_oil',
      remainingDistanceKm: 200,
    });

    expect(okChannel.deliver).toHaveBeenCalled();
    expect(failingChannel.deliver).toHaveBeenCalled();
    expect(result).toEqual(sampleNotification);
  });

  it('throws when raising an unknown kind', async () => {
    await expect(
      // @ts-expect-error: deliberately passing an unregistered kind
      service.raise('user-1', 'veh-1', 'nope', { vehicleId: 'veh-1' }),
    ).rejects.toThrow(/No AlertTemplate registered for kind "nope"/);
  });

  it('skips channel dispatch when the user has been deleted between raise and lookup', async () => {
    prisma.notification.create.mockResolvedValue(sampleNotification);
    prisma.user.findUnique.mockResolvedValue(null);

    await service.raise('user-1', 'veh-1', 'maintenance-due', {
      vehicleId: 'veh-1',
      category: 'engine_oil',
      remainingDistanceKm: 200,
    });

    expect(okChannel.deliver).not.toHaveBeenCalled();
  });
});

describe('NotifyService raise options', () => {
  const NOW = new Date('2026-09-18T06:00:00.000Z');
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * MS_PER_DAY);
  const daysLater = (days: number) => new Date(NOW.getTime() + days * MS_PER_DAY);
  const COOLDOWN = { cooldownDays: 90 };

  type Row = Record<string, unknown>;

  /**
   * The Notification and AlertRaise tables, held in memory and answering each
   * call the way Postgres would apply its `where` — `notification_dedup_unread`
   * included, so a second unread row with the same key is refused. Canned
   * answers would pass with the cooldown reading the wrong table, or with a
   * delete that took the cooldown's memory with it.
   */
  let notifications: Row[] = [];
  let raises: Row[] = [];
  let nextId = 1;

  const prismaError = (message: string, code: string) =>
    new PrismaClientKnownRequestError(message, { code, clientVersion: 'vitest' });

  const tables = {
    notification: {
      create: vi.fn(({ data }: { data: Row }) => {
        const unreadTwin = notifications.some(
          (row) => row.userId === data.userId && row.dedupKey === data.dedupKey && !row.isRead,
        );
        if (unreadTwin) {
          return Promise.reject(prismaError('Unique constraint failed', 'P2002'));
        }
        const row = { id: `notif-${nextId++}`, isRead: false, createdAt: new Date(), ...data };
        notifications.push(row);
        return Promise.resolve(row);
      }),
      findFirst: vi.fn(({ where }: { where: Row }) =>
        Promise.resolve(
          notifications.find(
            (row) =>
              row.userId === where.userId &&
              row.dedupKey === where.dedupKey &&
              row.isRead === where.isRead,
          ) ?? null,
        ),
      ),
      update: vi.fn(({ where, data }: { where: Row; data: Row }) => {
        const row = notifications.find((r) => r.id === where.id && r.userId === where.userId);
        if (!row) return Promise.reject(prismaError('Record not found', 'P2025'));
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
      delete: vi.fn(({ where }: { where: Row }) => {
        const index = notifications.findIndex(
          (r) => r.id === where.id && r.userId === where.userId,
        );
        if (index === -1) return Promise.reject(prismaError('Record not found', 'P2025'));
        return Promise.resolve(notifications.splice(index, 1)[0]);
      }),
    },
    alertRaise: {
      create: vi.fn(({ data }: { data: Row }) => {
        const row = { id: `raise-${nextId++}`, raisedAt: new Date(), ...data };
        raises.push(row);
        return Promise.resolve(row);
      }),
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            userId: string;
            vehicleId: string | null;
            kind: string;
            raisedAt: { gte: Date };
          };
        }) =>
          Promise.resolve(
            raises.filter(
              (row) =>
                row.userId === where.userId &&
                row.vehicleId === where.vehicleId &&
                row.kind === where.kind &&
                (row.raisedAt as Date) >= where.raisedAt.gte,
            ),
          ),
      ),
    },
  };

  const prisma = {
    ...tables,
    user: { findUnique: vi.fn() },
    /** All or nothing, as in Postgres: a callback that throws leaves nothing it wrote. */
    $transaction: vi.fn(async (write: (tx: typeof tables) => Promise<unknown>) => {
      const before = { notifications: [...notifications], raises: [...raises] };
      try {
        return await write(tables);
      } catch (error) {
        ({ notifications, raises } = before);
        throw error;
      }
    }),
  };

  const channel: Channel = { name: 'email', deliver: vi.fn() };
  let service: NotifyService;
  /** The user's side of the inbox — the same read and delete the controller calls. */
  let inbox: NotificationsService;

  const untracked = (odometer = 40_000) => ({
    vehicleId: 'veh-1',
    odometer,
    reason: 'untracked' as const,
  });

  /** A raise an earlier run has already recorded. */
  const raised = (overrides: Row) => ({
    id: 'raise-old',
    userId: 'user-1',
    vehicleId: 'veh-1',
    kind: 'tyre-uninspected',
    dedupKey: new TyreUninspectedTemplate().dedupKey(untracked()),
    raisedAt: daysAgo(30),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    notifications = [];
    raises = [];
    nextId = 1;
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com' });
    (channel.deliver as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    service = new NotifyService(
      prisma as never,
      [
        new TyreUninspectedTemplate(),
        new ServiceBaselineUnknownTemplate(),
        new MaintenanceDueTemplate(),
      ] as never,
      [channel],
    );
    inbox = new NotificationsService(prisma as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cooldownDays', () => {
    it('does not re-raise a prompt the user already read inside the window', async () => {
      // The whole point: the unread-only dedup index let a read prompt return
      // the next morning.
      const first = await service.raise(
        'user-1',
        'veh-1',
        'tyre-uninspected',
        untracked(),
        COOLDOWN,
      );
      if (!first) throw new Error('expected the first raise to create a row');
      await inbox.markAsRead('user-1', first.id);

      vi.setSystemTime(daysLater(30));
      const second = await service.raise(
        'user-1',
        'veh-1',
        'tyre-uninspected',
        untracked(),
        COOLDOWN,
      );

      expect(second).toBeNull();
      expect(notifications).toEqual([first]);
      expect(channel.deliver).toHaveBeenCalledTimes(1);
    });

    it('asks again once the window has passed', async () => {
      raises = [raised({ raisedAt: daysAgo(91) })];

      const result = await service.raise(
        'user-1',
        'veh-1',
        'tyre-uninspected',
        untracked(),
        COOLDOWN,
      );

      expect(result).not.toBeNull();
      expect(notifications).toEqual([result]);
      expect(channel.deliver).toHaveBeenCalledTimes(1);
    });

    it('treats a new odometer bucket as the same prompt', async () => {
      // The dedup key moved (40 000 km → 52 000 km crosses a bucket), but the
      // question put to the owner is identical, so it is still inside its cooldown.
      raises = [raised({ raisedAt: daysAgo(30) })];

      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(52_000), COOLDOWN);

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('does not let a different question for the same vehicle stand in for this one', async () => {
      raises = [
        raised({
          dedupKey: new TyreUninspectedTemplate().dedupKey({
            vehicleId: 'veh-1',
            odometer: 40_000,
            reason: 'stale',
            kmSinceLastCheck: 6_000,
            daysSinceLastCheck: 40,
          }),
        }),
      ];

      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), COOLDOWN);

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('does not let another vehicle’s prompt stand in for this one', async () => {
      raises = [raised({ vehicleId: 'veh-2', dedupKey: 'tyre-uninspected:veh-2:untracked:8' })];

      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), COOLDOWN);

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('falls back to the exact dedup key for a template with no cooldown key', async () => {
      const payload = { vehicleId: 'veh-1', category: 'engine_oil', remainingDistanceKm: 200 };
      raises = [
        raised({
          kind: 'maintenance-due',
          dedupKey: new MaintenanceDueTemplate().dedupKey(payload),
        }),
      ];

      await service.raise('user-1', 'veh-1', 'maintenance-due', payload, COOLDOWN);

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('is not consulted at all when the caller asks for no cooldown', async () => {
      raises = [raised({ raisedAt: daysAgo(1) })];

      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked());

      expect(prisma.alertRaise.findMany).not.toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('the raise record', () => {
    it('is written with the row, in one transaction', async () => {
      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), COOLDOWN);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(raises).toEqual([
        expect.objectContaining({
          userId: 'user-1',
          vehicleId: 'veh-1',
          kind: 'tyre-uninspected',
          dedupKey: new TyreUninspectedTemplate().dedupKey(untracked()),
          raisedAt: NOW,
        }),
      ]);
    });

    it('is not written when the unread dedup hands back the row already there', async () => {
      // Asked 100 days ago and never opened. The cooldown has run out, but the
      // unread row still asks the question, so nobody is asked anything new.
      const dedupKey = new TyreUninspectedTemplate().dedupKey(untracked());
      notifications = [
        {
          id: 'unread',
          userId: 'user-1',
          vehicleId: 'veh-1',
          kind: 'tyre-uninspected',
          dedupKey,
          isRead: false,
          createdAt: daysAgo(100),
        },
      ];
      raises = [raised({ raisedAt: daysAgo(100) })];

      const result = await service.raise(
        'user-1',
        'veh-1',
        'tyre-uninspected',
        untracked(),
        COOLDOWN,
      );

      expect(result?.id).toBe('unread');
      expect(raises).toHaveLength(1);
      expect(channel.deliver).not.toHaveBeenCalled();
    });

    it('takes the row down with it when it cannot be written', async () => {
      // A row the cooldown cannot see would be asked again the morning after
      // someone read or deleted it.
      prisma.alertRaise.create.mockRejectedValueOnce(
        prismaError('Foreign key constraint violated', 'P2003'),
      );

      await expect(
        service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), COOLDOWN),
      ).rejects.toThrow('Foreign key constraint violated');

      expect(notifications).toEqual([]);
      expect(channel.deliver).not.toHaveBeenCalled();
    });

    it('is not kept for an alert raised without a cooldown', async () => {
      await service.raise('user-1', 'veh-1', 'maintenance-due', {
        vehicleId: 'veh-1',
        category: 'engine_oil',
        remainingDistanceKm: 200,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(raises).toEqual([]);
      expect(notifications).toHaveLength(1);
    });
  });

  describe('a deleted prompt', () => {
    // Deleting is the plainest "stop asking" there is, and the one the
    // cooldown used to miss: it read Notification rows, and a delete removes
    // the row.
    const prompts = [
      {
        prompt: 'the tyre-tracking prompt',
        ask: (odometer: number) =>
          service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(odometer), COOLDOWN),
      },
      {
        prompt: 'the service-history prompt',
        ask: (odometer: number) =>
          service.raise(
            'user-1',
            'veh-1',
            'service-baseline-unknown',
            { vehicleId: 'veh-1', odometer, scope: 'vehicle' },
            COOLDOWN,
          ),
      },
    ];

    it.each(prompts)(
      'keeps $prompt quiet for the rest of its 90 days, then asks again',
      async ({ ask }) => {
        const first = await ask(40_000);
        if (!first) throw new Error('expected the first raise to create a row');
        await inbox.delete('user-1', first.id);
        expect(notifications).toEqual([]);

        // The next morning; halfway through, once the vehicle has driven into
        // another odometer bucket; and on day 89.
        for (const [day, odometer] of [
          [1, 40_000],
          [45, 52_000],
          [89, 52_500],
        ] as const) {
          vi.setSystemTime(daysLater(day));
          await expect(ask(odometer)).resolves.toBeNull();
        }

        expect(notifications).toEqual([]);
        expect(channel.deliver).toHaveBeenCalledTimes(1);

        vi.setSystemTime(daysLater(91));
        const again = await ask(53_000);

        expect(again).not.toBeNull();
        expect(notifications).toEqual([again]);
        expect(channel.deliver).toHaveBeenCalledTimes(2);
      },
    );

    it('still lets an alert raised without a cooldown come back after a delete', async () => {
      // Unchanged on purpose: deleting a due-service alert does not stop the
      // service being due.
      const payload = { vehicleId: 'veh-1', category: 'engine_oil', remainingDistanceKm: 200 };
      const first = await service.raise('user-1', 'veh-1', 'maintenance-due', payload);
      if (!first) throw new Error('expected the first raise to create a row');
      await inbox.delete('user-1', first.id);

      vi.setSystemTime(daysLater(1));
      const again = await service.raise('user-1', 'veh-1', 'maintenance-due', payload);

      expect(again).not.toBeNull();
      expect(notifications).toEqual([again]);
      expect(channel.deliver).toHaveBeenCalledTimes(2);
    });
  });

  describe('inAppOnly', () => {
    it('writes the row and delivers it through no channel', async () => {
      const result = await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), {
        inAppOnly: true,
      });

      expect(result).not.toBeNull();
      expect(notifications).toEqual([result]);
      expect(channel.deliver).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('delivers everywhere by default', async () => {
      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked());

      expect(channel.deliver).toHaveBeenCalledTimes(1);
    });
  });
});
