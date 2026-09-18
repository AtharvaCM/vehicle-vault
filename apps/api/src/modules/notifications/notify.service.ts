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
  type RaiseOptions,
} from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
   *
   * `options` can widen that into a cooldown across read rows too, and can keep
   * the alert off every external Channel — see {@link RaiseOptions}. Either way
   * the caller gets a row back: the one just created, or the one that made
   * creating it unnecessary.
   */
  async raise<K extends AlertKind>(
    userId: string,
    vehicleId: string | null,
    kind: K,
    payload: AlertPayloads[K],
    options: RaiseOptions = {},
  ): Promise<Notification> {
    const template = this.templateByKind.get(kind) as AlertTemplate<K> | undefined;
    if (!template) {
      throw new Error(`No AlertTemplate registered for kind "${kind}"`);
    }

    const dedupKey = template.dedupKey(payload);

    if (options.cooldownDays != null) {
      const recent = await this.findWithinCooldown(
        userId,
        vehicleId,
        kind,
        template.cooldownKey?.(payload) ?? null,
        dedupKey,
        options.cooldownDays,
      );
      if (recent) return recent;
    }

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

    if (wasCreated && !options.inAppOnly) {
      await this.dispatch(notification, userId);
    }

    return notification;
  }

  /**
   * The newest row this user has had for the same alert inside the window,
   * read or unread.
   *
   * Filtered by prefix in code rather than with a `startsWith` query: Prisma
   * compiles that to `LIKE`, where `_` in a key (a category such as
   * `engine_oil`) would match any character. The candidates are one user's
   * rows of one kind for one vehicle over a few months, so there is nothing to
   * gain from pushing the match into SQL. `(userId, kind, createdAt)` is indexed.
   */
  private async findWithinCooldown(
    userId: string,
    vehicleId: string | null,
    kind: AlertKind,
    cooldownKey: string | null,
    dedupKey: string,
    days: number,
  ): Promise<Notification | null> {
    const candidates = await this.prisma.notification.findMany({
      where: {
        userId,
        vehicleId,
        kind,
        createdAt: { gte: new Date(Date.now() - days * MS_PER_DAY) },
      },
      orderBy: { createdAt: 'desc' },
    });

    return (
      candidates.find((row) =>
        cooldownKey ? row.dedupKey?.startsWith(cooldownKey) : row.dedupKey === dedupKey,
      ) ?? null
    );
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
