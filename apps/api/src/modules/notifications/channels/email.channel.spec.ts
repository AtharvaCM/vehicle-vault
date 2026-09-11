import type { Notification, User } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailChannel } from './email.channel';
import { UnsubscribeTokenService } from '../unsubscribe-token.service';

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

  const appConfig = { apiPublicUrl: 'https://vault.example/api', jwtSecret: 'test-secret' };
  // The real token service: the unsubscribe URL is the thing under test in
  // several cases below, and a stub would let a broken link pass.
  const tokens = new UnsubscribeTokenService(appConfig as never);

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
    emailVerified: true,
    alertEmailsMutedAt: null,
  } as User;

  beforeEach(() => {
    vi.clearAllMocks();
    mailService.isConfigured = true;
    appConfig.apiPublicUrl = 'https://vault.example/api';
    mailService.sendMaintenanceAlert.mockResolvedValue(undefined);
    channel = new EmailChannel(mailService as never, prisma as never, tokens, appConfig as never);
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
      unsubscribeUrl: expect.stringContaining(
        'https://vault.example/api/notifications/unsubscribe',
      ),
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

  it('sends nothing to an address nobody has verified', async () => {
    // The 9 September burst: 30 prompts to accounts that had never confirmed
    // the address belonged to them.
    await channel.deliver(notification, { ...user, emailVerified: false });

    expect(mailService.sendMaintenanceAlert).not.toHaveBeenCalled();
  });

  it('sends nothing to a user who has muted alert email', async () => {
    await channel.deliver(notification, {
      ...user,
      alertEmailsMutedAt: new Date('2026-09-10T00:00:00.000Z'),
    });

    expect(mailService.sendMaintenanceAlert).not.toHaveBeenCalled();
  });

  it('withholds the alert rather than mail an opt-out link that leads nowhere', async () => {
    appConfig.apiPublicUrl = null as never;

    await channel.deliver(notification, user);

    expect(mailService.sendMaintenanceAlert).not.toHaveBeenCalled();
  });

  it('signs the unsubscribe link for the recipient, not the notification', async () => {
    // Whoever clicks it must end up muting this user and only this user.
    await channel.deliver({ ...notification, vehicleId: null }, user);

    const { unsubscribeUrl } = mailService.sendMaintenanceAlert.mock.calls[0][0];
    const token = new URL(unsubscribeUrl).searchParams.get('token');

    expect(token).toBeTruthy();
    expect(tokens.verify(token as string)).toBe('user-1');
  });
});
