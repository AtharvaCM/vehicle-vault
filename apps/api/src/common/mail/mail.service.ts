import { Logger, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { AppConfigService } from '../../config/app-config.service';

type PasswordResetEmailInput = {
  email: string;
  expiresAt: Date;
  name: string;
  resetUrl: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly appConfigService: AppConfigService) {
    this.transporter = this.createTransporter();
  }

  get isConfigured() {
    return Boolean(this.transporter && this.appConfigService.mailFrom);
  }

  async sendPasswordResetEmail(input: PasswordResetEmailInput) {
    const expiresAt = input.expiresAt.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    });
    const firstName = input.name.trim().split(/\s+/)[0] ?? 'there';
    const subject = 'Reset your Vehicle Vault password';

    return this.sendMail({
      to: input.email,
      subject,
      text: [
        `Hi ${firstName},`,
        '',
        'We received a request to reset your Vehicle Vault password.',
        `Reset your password here: ${input.resetUrl}`,
        '',
        `This link expires on ${expiresAt}.`,
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: [
        `<p>Hi ${escapeHtml(firstName)},</p>`,
        '<p>We received a request to reset your Vehicle Vault password.</p>',
        `<p><a href="${escapeAttribute(input.resetUrl)}">Reset your password</a></p>`,
        `<p>This link expires on ${escapeHtml(expiresAt)}.</p>`,
        '<p>If you did not request this, you can ignore this email.</p>',
      ].join(''),
    });
  }

  private createTransporter() {
    if (this.appConfigService.smtpUrl) {
      return createTransport(this.appConfigService.smtpUrl);
    }

    if (!this.appConfigService.smtpHost) {
      return null;
    }

    return createTransport({
      host: this.appConfigService.smtpHost,
      port: this.appConfigService.smtpPort,
      secure: this.appConfigService.smtpSecure,
      ...(this.appConfigService.smtpUser
        ? {
            auth: {
              user: this.appConfigService.smtpUser,
              pass: this.appConfigService.smtpPass ?? undefined,
            },
          }
        : {}),
    });
  }

  private async sendMail(input: { html: string; subject: string; text: string; to: string }) {
    if (!this.transporter || !this.appConfigService.mailFrom) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
    }

    try {
      await this.transporter.sendMail({
        from: this.appConfigService.mailFrom,
        replyTo: this.appConfigService.mailReplyTo ?? undefined,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${input.to}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException('Email delivery is unavailable right now.');
    }
  }
}

function escapeAttribute(value: string) {
  return value.replace(/"/g, '&quot;');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
