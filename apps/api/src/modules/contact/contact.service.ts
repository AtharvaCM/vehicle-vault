import { Injectable, Logger } from '@nestjs/common';
import { ContactMessageInputSchema, type ContactMessage } from '@vehicle-vault/shared';

import { MailService } from '../../common/mail/mail.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppConfigService } from '../../config/app-config.service';
import type { ContactMessageDto } from './dto/contact-message.dto';

/**
 * The public Contact page's messages (#341): stored first, so none is lost
 * while production mail is off, then mailed to the admins when it is on. A
 * filled honeypot is thanked and dropped.
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly appConfig: AppConfigService,
  ) {}

  async receive(payload: ContactMessageDto): Promise<{ received: true }> {
    const input = ContactMessageInputSchema.parse(payload);
    if (input.website) return { received: true };

    const stored = await this.prisma.contactMessage.create({
      data: { name: input.name, email: input.email, message: input.message },
    });

    if (this.mail.isConfigured) {
      for (const admin of this.appConfig.adminEmails) {
        try {
          await this.mail.sendContactMessage({ to: admin, ...input });
        } catch {
          // Stored already, and listed in the admin area: a failed mail loses nothing.
          this.logger.warn(`Could not mail contact message ${stored.id} to an admin`);
        }
      }
    }

    return { received: true };
  }

  /** The newest messages first, for the admin area. */
  async list(limit = 100): Promise<ContactMessage[]> {
    const rows = await this.prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }
}
