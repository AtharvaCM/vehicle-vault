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
    return this.configService.get<string>('app.supabaseStorageBucket') ?? 'vehicle-vault-attachments';
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
    return this.configService.get<string>('app.jwtRefreshSecret') ?? 'vehicle-vault-dev-refresh-secret';
  }

  get jwtRefreshExpiresIn() {
    return this.configService.get<string>('app.jwtRefreshExpiresIn') ?? '30d';
  }

  get nodeEnv(): NodeEnv {
    return this.configService.get<NodeEnv>('app.nodeEnv') ?? 'development';
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }

  get geminiApiKey() {
    return this.configService.get<string>('app.geminiApiKey') ?? null;
  }
}
