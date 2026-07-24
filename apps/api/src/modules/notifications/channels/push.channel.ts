import { Injectable, Logger } from '@nestjs/common';
import type { Notification, User } from '@prisma/client';

import { PushSubscriptionsService } from '../push-subscriptions.service';
import type { Channel } from '../types';

/**
 * Web-push fan-out for a Notification. The DB row stays canonical; this
 * channel is best-effort delivery to whatever browsers the user has
 * subscribed. Skips silently when VAPID keys are not configured.
 */
@Injectable()
export class PushChannel implements Channel {
  readonly name = 'push';
  private readonly logger = new Logger(PushChannel.name);

  constructor(private readonly pushSubscriptions: PushSubscriptionsService) {}

  async deliver(notification: Notification, user: User): Promise<void> {
    if (!this.pushSubscriptions.isConfigured) {
      this.logger.debug(
        `Skipping push for notification ${notification.id}: VAPID keys not configured.`,
      );
      return;
    }

    await this.pushSubscriptions.sendToUser(user.id, {
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: notification.link,
    });
  }
}
