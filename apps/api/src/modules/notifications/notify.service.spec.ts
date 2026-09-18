import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotifyService } from './notify.service';
import { MaintenanceDueTemplate } from './templates/maintenance-due.template';
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
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

  /** The rows a user already has, filtered the way Postgres would apply the `where`. */
  let existing: Record<string, unknown>[] = [];

  const prisma = {
    notification: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn((args: { where: Record<string, unknown> }) => {
        const where = args.where as {
          userId: string;
          vehicleId: string | null;
          kind: string;
          createdAt: { gte: Date };
        };
        return Promise.resolve(
          existing
            .filter(
              (row) =>
                row.userId === where.userId &&
                row.vehicleId === where.vehicleId &&
                row.kind === where.kind &&
                (row.createdAt as Date) >= where.createdAt.gte,
            )
            .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime()),
        );
      }),
    },
    user: { findUnique: vi.fn() },
  };

  const channel: Channel = { name: 'email', deliver: vi.fn() };
  let service: NotifyService;

  const untracked = (odometer = 40_000) => ({
    vehicleId: 'veh-1',
    odometer,
    reason: 'untracked' as const,
  });

  const row = (overrides: Record<string, unknown>) => ({
    id: 'old',
    userId: 'user-1',
    vehicleId: 'veh-1',
    kind: 'tyre-uninspected',
    dedupKey: new TyreUninspectedTemplate().dedupKey(untracked()),
    isRead: true,
    createdAt: daysAgo(30),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    existing = [];
    prisma.notification.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ id: 'new', ...data }),
    );
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com' });
    (channel.deliver as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    service = new NotifyService(
      prisma as never,
      [new TyreUninspectedTemplate(), new MaintenanceDueTemplate()] as never,
      [channel],
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cooldownDays', () => {
    it('does not re-raise a prompt the user already read inside the window', async () => {
      // The whole point: the unread-only dedup index let a read prompt return
      // the next morning.
      existing = [row({ isRead: true, createdAt: daysAgo(30) })];

      const result = await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), {
        cooldownDays: 90,
      });

      expect(result.id).toBe('old');
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(channel.deliver).not.toHaveBeenCalled();
    });

    it('asks again once the window has passed', async () => {
      existing = [row({ createdAt: daysAgo(91) })];

      const result = await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), {
        cooldownDays: 90,
      });

      expect(result.id).toBe('new');
      expect(channel.deliver).toHaveBeenCalledTimes(1);
    });

    it('treats a new odometer bucket as the same prompt', async () => {
      // The dedup key moved (40 000 km → 52 000 km crosses a bucket), but the
      // question put to the owner is identical, so it is still inside its cooldown.
      existing = [row({ createdAt: daysAgo(30) })];

      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(52_000), {
        cooldownDays: 90,
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('does not let a different question for the same vehicle stand in for this one', async () => {
      existing = [
        row({
          dedupKey: new TyreUninspectedTemplate().dedupKey({
            vehicleId: 'veh-1',
            odometer: 40_000,
            reason: 'stale',
            kmSinceLastCheck: 6_000,
            daysSinceLastCheck: 40,
          }),
        }),
      ];

      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), { cooldownDays: 90 });

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('does not let another vehicle’s prompt stand in for this one', async () => {
      existing = [row({ vehicleId: 'veh-2', dedupKey: 'tyre-uninspected:veh-2:untracked:8' })];

      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), { cooldownDays: 90 });

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('falls back to the exact dedup key for a template with no cooldown key', async () => {
      const payload = { vehicleId: 'veh-1', category: 'engine_oil', remainingDistanceKm: 200 };
      existing = [
        row({
          kind: 'maintenance-due',
          dedupKey: new MaintenanceDueTemplate().dedupKey(payload),
        }),
      ];

      await service.raise('user-1', 'veh-1', 'maintenance-due', payload, { cooldownDays: 90 });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('is not consulted at all when the caller asks for no cooldown', async () => {
      existing = [row({ isRead: true, createdAt: daysAgo(1) })];

      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked());

      expect(prisma.notification.findMany).not.toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('inAppOnly', () => {
    it('writes the row and delivers it through no channel', async () => {
      const result = await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked(), {
        inAppOnly: true,
      });

      expect(result.id).toBe('new');
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(channel.deliver).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('delivers everywhere by default', async () => {
      await service.raise('user-1', 'veh-1', 'tyre-uninspected', untracked());

      expect(channel.deliver).toHaveBeenCalledTimes(1);
    });
  });
});
