import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
