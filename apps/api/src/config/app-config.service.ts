import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DEFAULT_APP_PORT, DEFAULT_FRONTEND_ORIGIN } from '../common/constants/app.constants';
import type { NodeEnv } from '../common/types/node-env.type';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port() {
    return this.configService.get<number>('app.port') ?? DEFAULT_APP_PORT;
  }

  get frontendOrigins() {
    return this.configService.get<string[]>('app.frontendOrigins') ?? [DEFAULT_FRONTEND_ORIGIN];
  }

  get frontendOrigin() {
    return this.frontendOrigins[0] ?? DEFAULT_FRONTEND_ORIGIN;
  }

  get frontendOriginPattern() {
    return this.configService.get<RegExp | null>('app.frontendOriginPattern') ?? null;
  }

  get attachmentStorageBackend() {
    return this.configService.get<'local' | 'supabase'>('app.attachmentStorageBackend') ?? 'local';
  }

  get attachmentLocalStoragePath() {
    return this.configService.get<string>('app.attachmentLocalStoragePath') ?? 'uploads';
  }

  get databaseUrl() {
    return (
      this.configService.get<string>('app.databaseUrl') ??
      'postgresql://postgres:postgres@localhost:5432/vehicle_vault?schema=public'
    );
  }

  get mailFrom() {
    return this.configService.get<string>('app.mailFrom') ?? null;
  }

  get mailReplyTo() {
    return this.configService.get<string>('app.mailReplyTo') ?? null;
  }

  get supabaseUrl() {
    return this.configService.get<string>('app.supabaseUrl') ?? null;
  }

  get supabaseServiceRoleKey() {
    return this.configService.get<string>('app.supabaseServiceRoleKey') ?? null;
  }

  get supabaseStorageBucket() {
    return (
      this.configService.get<string>('app.supabaseStorageBucket') ?? 'vehicle-vault-attachments'
    );
  }

  get smtpHost() {
    return this.configService.get<string>('app.smtpHost') ?? null;
  }

  get smtpPass() {
    return this.configService.get<string>('app.smtpPass') ?? null;
  }

  get smtpPort() {
    return this.configService.get<number>('app.smtpPort') ?? 587;
  }

  get smtpSecure() {
    return this.configService.get<boolean>('app.smtpSecure') ?? false;
  }

  get smtpUrl() {
    return this.configService.get<string>('app.smtpUrl') ?? null;
  }

  get smtpUser() {
    return this.configService.get<string>('app.smtpUser') ?? null;
  }

  get jwtSecret() {
    return this.configService.get<string>('app.jwtSecret') ?? 'vehicle-vault-dev-secret';
  }

  get jwtExpiresIn() {
    return this.configService.get<string>('app.jwtExpiresIn') ?? '7d';
  }

  get jwtRefreshSecret() {
    return (
      this.configService.get<string>('app.jwtRefreshSecret') ?? 'vehicle-vault-dev-refresh-secret'
    );
  }

  get jwtRefreshExpiresIn() {
    return this.configService.get<string>('app.jwtRefreshExpiresIn') ?? '30d';
  }

  get oauthGoogleClientId() {
    return this.configService.get<string | null>('app.oauthGoogleClientId') ?? null;
  }

  get oauthGoogleClientSecret() {
    return this.configService.get<string | null>('app.oauthGoogleClientSecret') ?? null;
  }

  get oauthGoogleCallbackUrl() {
    return this.configService.get<string | null>('app.oauthGoogleCallbackUrl') ?? null;
  }

  get oauthGithubClientId() {
    return this.configService.get<string | null>('app.oauthGithubClientId') ?? null;
  }

  get oauthGithubClientSecret() {
    return this.configService.get<string | null>('app.oauthGithubClientSecret') ?? null;
  }

  get oauthGithubCallbackUrl() {
    return this.configService.get<string | null>('app.oauthGithubCallbackUrl') ?? null;
  }

  get oauthFrontendRedirectUrl() {
    return (
      this.configService.get<string | null>('app.oauthFrontendRedirectUrl') ??
      `${this.frontendOrigin.replace(/\/$/, '')}/auth/oauth-callback`
    );
  }

  get isGoogleOAuthConfigured() {
    return Boolean(
      this.oauthGoogleClientId && this.oauthGoogleClientSecret && this.oauthGoogleCallbackUrl,
    );
  }

  get isGithubOAuthConfigured() {
    return Boolean(
      this.oauthGithubClientId && this.oauthGithubClientSecret && this.oauthGithubCallbackUrl,
    );
  }

  get nodeEnv(): NodeEnv {
    return this.configService.get<NodeEnv>('app.nodeEnv') ?? 'development';
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }

  get geminiApiKey(): string | undefined {
    return this.configService.get<string>('GEMINI_API_KEY');
  }

  get geminiModel() {
    return this.configService.get<string>('app.geminiModel') ?? 'gemini-2.5-flash';
  }

  get maintenanceAlertCron() {
    return this.configService.get<string>('MAINTENANCE_ALERT_CRON') ?? '0 6 * * *';
  }

  get smtpConfig() {
    return {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      user: this.configService.get<string>('SMTP_USER'),
      pass: this.configService.get<string>('SMTP_PASS'),
      from: this.configService.get<string>('SMTP_FROM', 'no-reply@middle-earth.in'),
    };
  }
}
