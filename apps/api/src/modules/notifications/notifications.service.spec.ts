import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };
  const prisma = {
    $transaction: vi.fn(),
    notification: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (client: typeof prisma) => unknown) =>
      callback(prisma),
    );
    service = new NotificationsService(prisma as never, productEvents as never);
  });

  describe('markReadForDocument', () => {
    it('marks every unread document-expiring notification whose dedupKey belongs to the document', async () => {
      await service.markReadForDocument('user-1', 'doc-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          kind: 'document-expiring',
          dedupKey: { startsWith: 'document-expiring:doc-1:' },
          isRead: false,
        },
        data: { isRead: true },
      });
    });

    it('scopes the dedupKey prefix so a different document is never matched', async () => {
      await service.markReadForDocument('user-1', 'doc-1');

      const [{ where }] = prisma.notification.updateMany.mock.calls[0] as [
        { where: { dedupKey: { startsWith: string } } },
      ];
      // The trailing ":" stops "doc-1" from prefix-matching "doc-12"'s dedupKey.
      expect('document-expiring:doc-12:7d'.startsWith(where.dedupKey.startsWith)).toBe(false);
      expect('document-expiring:doc-1:7d'.startsWith(where.dedupKey.startsWith)).toBe(true);
    });
  });

  describe('markReadForReminder', () => {
    it('marks both the due and overdue notification for the reminder read', async () => {
      await service.markReadForReminder('user-1', 'reminder-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          dedupKey: { in: ['reminder-due:reminder-1', 'reminder-overdue:reminder-1'] },
          isRead: false,
        },
        data: { isRead: true },
      });
    });
  });

  describe('open', () => {
    const unread = {
      id: 'notif-1',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
      kind: 'reminder-due',
      isRead: false,
    };

    it('marks an unread notification read and records its first open', async () => {
      prisma.notification.findFirst.mockResolvedValue(unread);
      prisma.notification.update.mockResolvedValue({ ...unread, isRead: true });

      const opened = await service.open('user-1', 'notif-1');

      expect(opened.isRead).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
      expect(productEvents.record).toHaveBeenCalledWith(prisma, {
        name: 'notification_opened',
        userId: 'user-1',
        properties: { kind: 'reminder-due', firstOpen: true },
      });
    });

    it('counts a revisit as an open, but not as the first one', async () => {
      prisma.notification.findFirst.mockResolvedValue({ ...unread, isRead: true });

      await service.open('user-1', 'notif-1');

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(productEvents.record).toHaveBeenCalledWith(prisma, {
        name: 'notification_opened',
        userId: 'user-1',
        properties: { kind: 'reminder-due', firstOpen: false },
      });
    });

    it('carries no vehicle, since a notification can outlive the vehicle it names', async () => {
      prisma.notification.findFirst.mockResolvedValue(unread);
      prisma.notification.update.mockResolvedValue({ ...unread, isRead: true });

      await service.open('user-1', 'notif-1');

      expect(productEvents.record.mock.calls[0][1]).not.toHaveProperty('vehicleId');
    });

    it("refuses someone else's notification and records nothing", async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.open('user-2', 'notif-1')).rejects.toThrow('Notification not found.');
      expect(productEvents.record).not.toHaveBeenCalled();
      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-2' },
      });
    });
  });
});
