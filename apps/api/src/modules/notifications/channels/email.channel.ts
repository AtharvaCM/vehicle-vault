import { Injectable, Logger } from '@nestjs/common';
import type { Notification, User } from '@prisma/client';

import { UnsubscribeTokenService } from '../unsubscribe-token.service';
import { AppConfigService } from '../../../config/app-config.service';
import { MailService } from '../../../common/mail/mail.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { Channel } from '../types';

/**
 * Alert mail, and the three questions asked before any of it leaves.
 *
 * Every one of them fails closed, and none of them touches the **Notification**
 * row or the push Channel: an alert the user should not be emailed is still an
 * alert, and it still reaches them in the app and on their phone. Suppressing
 * the record along with the mail would hide the thing from the person who asked
 * to be told about it.
 */
@Injectable()
export class EmailChannel implements Channel {
  readonly name = 'email';
  private readonly logger = new Logger(EmailChannel.name);

  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly unsubscribeTokens: UnsubscribeTokenService,
    private readonly appConfigService: AppConfigService,
  ) {}

  async deliver(notification: Notification, user: User): Promise<void> {
    if (!this.mailService.isConfigured) {
      this.logger.debug(
        `Skipping email for notification ${notification.id}: mail transport not configured.`,
      );
      return;
    }

    // Nobody has confirmed this address belongs to the person who typed it.
    // Mailing it anyway is how 30 prompts reached accounts that had never
    // verified on 9 September — and an unverified address may well belong to
    // someone who never heard of us.
    if (!user.emailVerified) {
      this.logger.debug(
        `Skipping email for notification ${notification.id}: ${user.id} has not verified their email.`,
      );
      return;
    }

    if (user.alertEmailsMutedAt) {
      this.logger.debug(
        `Skipping email for notification ${notification.id}: ${user.id} has muted alert email.`,
      );
      return;
    }

    const unsubscribeUrl = this.buildUnsubscribeUrl(user.id);
    if (!unsubscribeUrl) {
      // Logged as an error, not debug: this is a misconfiguration that silently
      // disables alert mail, and it should be loud enough to notice in the logs
      // rather than looking like a user preference.
      this.logger.error(
        `Skipping email for notification ${notification.id}: API_PUBLIC_URL is not configured, so the unsubscribe link cannot be built.`,
      );
      return;
    }

    const vehicleName = await this.resolveVehicleName(notification.vehicleId);

    await this.mailService.sendMaintenanceAlert({
      email: user.email,
      userName: user.name,
      vehicleName,
      alertTitle: notification.title,
      message: notification.message,
      unsubscribeUrl,
    });
  }

  private buildUnsubscribeUrl(userId: string): string | null {
    const base = this.appConfigService.apiPublicUrl;
    if (!base) return null;

    const url = new URL(`${base.replace(/\/$/, '')}/notifications/unsubscribe`);
    url.searchParams.set('token', this.unsubscribeTokens.issue(userId));
    return url.toString();
  }

  private async resolveVehicleName(vehicleId: string | null): Promise<string> {
    if (!vehicleId) return 'your vehicle';

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { make: true, model: true, nickname: true },
    });

    if (!vehicle) return 'your vehicle';
    return vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`;
  }
}
