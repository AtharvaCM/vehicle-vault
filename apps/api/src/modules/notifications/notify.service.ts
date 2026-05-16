import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { Notification } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ALERT_TEMPLATES,
  NOTIFICATION_CHANNELS,
  type AlertKind,
  type AlertPayloads,
  type AlertTemplate,
  type Channel,
} from './types';

@Injectable()
export class NotifyService {
  private readonly logger = new Logger(NotifyService.name);
  private readonly templateByKind: Map<AlertKind, AlertTemplate<AlertKind>>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ALERT_TEMPLATES) private readonly templates: AlertTemplate<AlertKind>[],
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: Channel[],
  ) {
    this.templateByKind = new Map(this.templates.map((t) => [t.kind, t]));
  }

  /**
   * Raise an alert: render its content, persist a Notification deduped by the
   * template's dedupKey, and fan out delivery to all configured channels.
   *
   * Dedup is enforced by the `notification_dedup_unread` partial unique index
   * — at most one unread row per `(userId, dedupKey)`. On collision we return
   * the existing row instead of throwing.
   */
  async raise<K extends AlertKind>(
    userId: string,
    vehicleId: string | null,
    kind: K,
    payload: AlertPayloads[K],
  ): Promise<Notification> {
    const template = this.templateByKind.get(kind) as AlertTemplate<K> | undefined;
    if (!template) {
      throw new Error(`No AlertTemplate registered for kind "${kind}"`);
    }

    const dedupKey = template.dedupKey(payload);
    const rendered = template.render(payload);

    let notification: Notification;
    let wasCreated = false;

    try {
      notification = await this.prisma.notification.create({
        data: {
          userId,
          vehicleId,
          kind,
          dedupKey,
          title: rendered.title,
          message: rendered.message,
          type: rendered.type,
          link: rendered.link,
        },
      });
      wasCreated = true;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.notification.findFirst({
          where: { userId, dedupKey, isRead: false },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) return existing;
      }
      throw error;
    }

    if (wasCreated) {
      await this.dispatch(notification, userId);
    }

    return notification;
  }

  private async dispatch(notification: Notification, userId: string): Promise<void> {
    if (this.channels.length === 0) return;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.warn(
        `Skipping channel dispatch for notification ${notification.id}: user ${userId} not found.`,
      );
      return;
    }

    const results = await Promise.allSettled(
      this.channels.map((channel) => channel.deliver(notification, user)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const channelName = this.channels[index]?.name ?? 'unknown';
        this.logger.error(
          `Channel "${channelName}" failed to deliver notification ${notification.id}`,
          result.reason instanceof Error ? result.reason.stack : String(result.reason),
        );
      }
    });
  }
}
