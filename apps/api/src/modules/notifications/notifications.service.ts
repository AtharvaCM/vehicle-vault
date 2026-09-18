import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductEventsService } from '../product-events/product-events.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productEvents: ProductEventsService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, id: string) {
    return this.prisma.notification.update({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  /**
   * The bell's "open": mark it read and record that it was opened, together.
   * Distinct from `markAsRead`, which marks without counting — only an open from
   * the list says the alert brought someone back. `firstOpen` separates the open
   * that followed the nudge from later revisits.
   *
   * No vehicle on the event: a notification's vehicleId has no foreign key and can
   * name a vehicle deleted since, which the event's foreign key would refuse —
   * failing the open over bookkeeping. The kind says enough.
   */
  async open(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.findFirst({ where: { id, userId } });
      if (!notification) {
        throw new NotFoundException('Notification not found.');
      }

      const opened = notification.isRead
        ? notification
        : await tx.notification.update({ where: { id }, data: { isRead: true } });

      await this.productEvents.record(tx, {
        name: 'notification_opened',
        userId,
        properties: { kind: notification.kind, firstOpen: !notification.isRead },
      });

      return opened;
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Marks every unread `document-expiring` notification for this document
   * read, across all of its dedup windows (see `DocumentExpiringTemplate.dedupKey`
   * — one row per 7d/30d bucket the document has crossed).
   */
  async markReadForDocument(userId: string, documentId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        kind: 'document-expiring',
        dedupKey: { startsWith: `document-expiring:${documentId}:` },
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  /**
   * Marks any unread `reminder-due` and `reminder-overdue` notification for
   * this reminder read. Both templates dedupe on the bare reminder id (see
   * `ReminderDueTemplate`/`ReminderOverdueTemplate.dedupKey`, no bucket
   * suffix), so an exact match on both possible keys is enough.
   */
  async markReadForReminder(userId: string, reminderId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        dedupKey: { in: [`reminder-due:${reminderId}`, `reminder-overdue:${reminderId}`] },
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async create(data: {
    userId: string;
    vehicleId?: string;
    title: string;
    message: string;
    type?: string;
    link?: string;
  }) {
    // Basic deduplication: don't create same title/message for same vehicle if unread
    if (data.vehicleId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: data.userId,
          vehicleId: data.vehicleId,
          title: data.title,
          isRead: false,
        },
      });
      if (existing) return existing;
    }

    return this.prisma.notification.create({ data });
  }

  async delete(userId: string, id: string) {
    return this.prisma.notification.delete({
      where: { id, userId },
    });
  }
}
