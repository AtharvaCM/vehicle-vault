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

  async sendVerificationEmail(input: { email: string; name: string; verificationUrl: string }) {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="display: flex; align-items: center; margin-bottom: 24px;">
          <div style="height: 32px; width: 32px; background-color: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; margin-right: 12px;">VV</div>
          <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Vehicle Vault</h2>
        </div>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">Hi ${escapeHtml(input.name)},</p>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">Thanks for joining Vehicle Vault! Before you can start managing your garage, we need to verify your email address.</p>
        <div style="margin: 32px 0;">
          <a href="${escapeAttribute(input.verificationUrl)}" style="background-color: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #475569; font-size: 14px; line-height: 20px;">Or copy and paste this link into your browser:</p>
        <p style="color: #0f172a; font-size: 14px; word-break: break-all; margin-top: 8px;">${escapeHtml(input.verificationUrl)}</p>
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 18px;">
            If you didn't create an account with us, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;

    return this.sendMail({
      to: input.email,
      subject: 'Welcome to Vehicle Vault! Please verify your email',
      text: `Hi ${input.name},\n\nPlease verify your email address by clicking this link: ${input.verificationUrl}`,
      html,
    });
  }

  async sendMaintenanceAlert(input: {
    alertTitle: string;
    email: string;
    message: string;
    userName: string;
    vehicleName: string;
  }) {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="display: flex; align-items: center; margin-bottom: 24px;">
          <div style="height: 32px; width: 32px; background-color: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; margin-right: 12px;">VV</div>
          <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Vehicle Vault</h2>
        </div>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">Hi ${escapeHtml(input.userName)},</p>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">This is a proactive maintenance reminder for your <strong>${escapeHtml(input.vehicleName)}</strong>.</p>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <h3 style="margin-top: 0; color: #92400e; font-size: 16px; font-weight: 700;">${escapeHtml(input.alertTitle)}</h3>
          <p style="margin-bottom: 0; color: #78350f; font-size: 14px; line-height: 20px;">${escapeHtml(input.message)}</p>
        </div>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">Regular maintenance prevents costly repairs and keeps you safe on the road. We recommend scheduling a visit to your preferred workshop soon.</p>
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 18px;">
            This is an automated intelligence alert from your Vehicle Vault companion. 
            You received this because your driving trends indicate a service milestone is approaching.
          </p>
        </div>
      </div>
    `;

    return this.sendMail({
      to: input.email,
      subject: `⚠️ Maintenance Alert: ${input.vehicleName} - ${input.alertTitle}`,
      text: `Maintenance Alert for ${input.vehicleName}: ${input.alertTitle}\n\n${input.message}`,
      html,
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
