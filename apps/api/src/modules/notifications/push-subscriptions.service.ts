import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

/**
 * Owns browser push endpoints and the web-push (VAPID) plumbing.
 * Subscriptions are device bookkeeping: upserted on subscribe, deleted on
 * unsubscribe, and pruned automatically when the push service reports the
 * endpoint gone (404/410).
 */
@Injectable()
export class PushSubscriptionsService {
  private readonly logger = new Logger(PushSubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {
    if (this.isConfigured) {
      webpush.setVapidDetails(
        this.config.vapidSubject,
        this.config.vapidPublicKey as string,
        this.config.vapidPrivateKey as string,
      );
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.config.vapidPublicKey && this.config.vapidPrivateKey);
  }

  get publicKey(): string | null {
    return this.config.vapidPublicKey ?? null;
  }

  async subscribe(userId: string, input: PushSubscriptionInput) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
      // Endpoint reused by a different login on the same browser: rebind.
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { subscribed: false };
  }

  /**
   * Send a payload to every registered endpoint of the user. Failures are
   * per-endpoint: dead endpoints (404/410) are pruned, other errors logged.
   */
  async sendToUser(userId: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.isConfigured) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
          await this.prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastUsedAt: new Date() },
          });
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => undefined);
            this.logger.debug(`Pruned dead push endpoint for user ${userId}`);
          } else {
            this.logger.warn(
              `Push delivery failed for user ${userId} (status ${statusCode ?? 'unknown'})`,
            );
          }
        }
      }),
    );
  }
}
