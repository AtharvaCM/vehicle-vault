import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

import * as webpush from 'web-push';

import { PushSubscriptionsService } from './push-subscriptions.service';

const configured = {
  vapidPublicKey: 'pub',
  vapidPrivateKey: 'priv',
  vapidSubject: 'mailto:test@example.com',
};

const subRow = {
  id: 'sub-1',
  userId: 'user-1',
  endpoint: 'https://push.example/ep1',
  p256dh: 'p',
  auth: 'a',
};

describe('PushSubscriptionsService', () => {
  const prisma = {
    pushSubscription: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is not configured without VAPID keys and skips sends entirely', async () => {
    const service = new PushSubscriptionsService(
      prisma as never,
      { vapidPublicKey: undefined, vapidPrivateKey: undefined, vapidSubject: 'x' } as never,
    );
    expect(service.isConfigured).toBe(false);
    await service.sendToUser('user-1', { title: 't' });
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it('sends the payload to every endpoint and stamps lastUsedAt', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([subRow]);
    vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

    const service = new PushSubscriptionsService(prisma as never, configured as never);
    await service.sendToUser('user-1', { title: 'Oil change due' });

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: subRow.endpoint, keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify({ title: 'Oil change due' }),
    );
    expect(prisma.pushSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('prunes an endpoint the push service reports gone (410)', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([subRow]);
    vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 410 });
    prisma.pushSubscription.delete.mockResolvedValue(subRow);

    const service = new PushSubscriptionsService(prisma as never, configured as never);
    await service.sendToUser('user-1', { title: 't' });

    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: 'sub-1' } });
  });

  it('keeps the subscription on transient delivery errors', async () => {
    prisma.pushSubscription.findMany.mockResolvedValue([subRow]);
    vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 500 });

    const service = new PushSubscriptionsService(prisma as never, configured as never);
    await service.sendToUser('user-1', { title: 't' });

    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it('rebinds an existing endpoint to the subscribing user on upsert', async () => {
    const service = new PushSubscriptionsService(prisma as never, configured as never);
    await service.subscribe('user-2', {
      endpoint: subRow.endpoint,
      keys: { p256dh: 'p2', auth: 'a2' },
    });
    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: subRow.endpoint },
        update: expect.objectContaining({ userId: 'user-2' }),
      }),
    );
  });
});
