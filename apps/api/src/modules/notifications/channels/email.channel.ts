import { Injectable, Logger } from '@nestjs/common';
import type { Notification, User } from '@prisma/client';

import { MailService } from '../../../common/mail/mail.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { Channel } from '../types';

@Injectable()
export class EmailChannel implements Channel {
  readonly name = 'email';
  private readonly logger = new Logger(EmailChannel.name);

  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  async deliver(notification: Notification, user: User): Promise<void> {
    if (!this.mailService.isConfigured) {
      this.logger.debug(
        `Skipping email for notification ${notification.id}: mail transport not configured.`,
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
    });
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
