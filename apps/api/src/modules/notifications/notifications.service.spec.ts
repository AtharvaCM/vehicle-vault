import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    notification: {
      updateMany: vi.fn(),
    },
  };

  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsService(prisma as never);
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
});
