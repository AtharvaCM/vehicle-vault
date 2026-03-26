import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: AppConfigService) {
    const smtp = this.config.smtpConfig;
    
    if (smtp.host && smtp.user) {
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });
      this.logger.log(`SMTP configured: ${smtp.host}:${smtp.port}`);
    } else {
      this.logger.warn('SMTP is not configured. Emails will be logged to console instead.');
    }
  }

  async sendMaintenanceAlert(
    to: string,
    userName: string,
    vehicleName: string,
    alertTitle: string,
    message: string,
  ) {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="display: flex; align-items: center; margin-bottom: 24px;">
          <div style="height: 32px; width: 32px; background-color: #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; margin-right: 12px;">VV</div>
          <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.025em;">Vehicle Vault</h2>
        </div>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">Hi ${userName},</p>
        <p style="color: #475569; font-size: 16px; line-height: 24px;">This is a proactive maintenance reminder for your <strong>${vehicleName}</strong>.</p>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
          <h3 style="margin-top: 0; color: #92400e; font-size: 16px; font-weight: 700;">${alertTitle}</h3>
          <p style="margin-bottom: 0; color: #78350f; font-size: 14px; line-height: 20px;">${message}</p>
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

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.config.smtpConfig.from,
          to,
          subject: `⚠️ Maintenance Alert: ${vehicleName} - ${alertTitle}`,
          html,
        });
        this.logger.log(`Maintenance email sent to ${to} for vehicle ${vehicleName}`);
      } catch (error) {
        this.logger.error(`Failed to send maintenance email to ${to}`, error);
      }
    } else {
      this.logger.log(`
--- [SIMULATED EMAIL] ---
TO: ${to}
SUBJECT: Maintenance Alert: ${vehicleName} - ${alertTitle}
BODY: ${message}
--------------------------
      `);
    }
  }
}
