import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotifyService } from './notify.service';
import { MaintenanceDueTemplate } from './templates/maintenance-due.template';
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
    service = new NotifyService(
      prisma as never,
      [template] as never,
      [okChannel],
    );
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

    service = new NotifyService(
      prisma as never,
      [template] as never,
      [okChannel, failingChannel],
    );

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
