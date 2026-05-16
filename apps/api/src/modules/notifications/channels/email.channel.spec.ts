import type { Notification, User } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailChannel } from './email.channel';

describe('EmailChannel', () => {
  const mailService = {
    isConfigured: true,
    sendMaintenanceAlert: vi.fn(),
  };

  const prisma = {
    vehicle: {
      findUnique: vi.fn(),
    },
  };

  let channel: EmailChannel;

  const notification: Notification = {
    id: 'notif-1',
    userId: 'user-1',
    vehicleId: 'veh-1',
    kind: 'maintenance-due',
    dedupKey: 'maintenance-due:veh-1:engine_oil',
    title: 'Service Due Soon: Engine Oil',
    message: 'Your Engine Oil is due in approx. 200 km.',
    type: 'warning',
    isRead: false,
    link: '/vehicles/veh-1?tab=maintenance',
    createdAt: new Date('2026-05-16T00:00:00.000Z'),
    updatedAt: new Date('2026-05-16T00:00:00.000Z'),
  } as Notification;

  const user: User = {
    id: 'user-1',
    email: 'atharva@example.com',
    name: 'Atharva',
  } as User;

  beforeEach(() => {
    vi.clearAllMocks();
    mailService.isConfigured = true;
    mailService.sendMaintenanceAlert.mockResolvedValue(undefined);
    channel = new EmailChannel(mailService as never, prisma as never);
  });

  it('sends a maintenance alert with vehicle nickname when present', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({
      make: 'Honda',
      model: 'City',
      nickname: 'Silver Bullet',
    });

    await channel.deliver(notification, user);

    expect(prisma.vehicle.findUnique).toHaveBeenCalledWith({
      where: { id: 'veh-1' },
      select: { make: true, model: true, nickname: true },
    });
    expect(mailService.sendMaintenanceAlert).toHaveBeenCalledWith({
      email: 'atharva@example.com',
      userName: 'Atharva',
      vehicleName: 'Silver Bullet',
      alertTitle: 'Service Due Soon: Engine Oil',
      message: 'Your Engine Oil is due in approx. 200 km.',
    });
  });

  it('falls back to make + model when nickname is null', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({
      make: 'Honda',
      model: 'City',
      nickname: null,
    });

    await channel.deliver(notification, user);

    expect(mailService.sendMaintenanceAlert).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleName: 'Honda City' }),
    );
  });

  it('uses a generic vehicle name when notification has no vehicleId', async () => {
    await channel.deliver({ ...notification, vehicleId: null }, user);

    expect(prisma.vehicle.findUnique).not.toHaveBeenCalled();
    expect(mailService.sendMaintenanceAlert).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleName: 'your vehicle' }),
    );
  });

  it('skips delivery silently when the mail transport is not configured', async () => {
    mailService.isConfigured = false;

    await channel.deliver(notification, user);

    expect(prisma.vehicle.findUnique).not.toHaveBeenCalled();
    expect(mailService.sendMaintenanceAlert).not.toHaveBeenCalled();
  });
});
