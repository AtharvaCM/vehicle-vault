import { registerAs } from '@nestjs/config';

import { DEFAULT_APP_PORT, DEFAULT_FRONTEND_ORIGIN } from '../common/constants/app.constants';
import type { NodeEnv } from '../common/types/node-env.type';

function resolveNodeEnv(value: string | undefined): NodeEnv {
  const normalized = value ?? 'development';

  if (normalized === 'development' || normalized === 'test' || normalized === 'production') {
    return normalized;
  }

  return 'development';
}

function resolvePort(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_APP_PORT;
}

function resolvePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveBoolean(value: string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function resolveOptionalString(value: string | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function resolveAttachmentStorageBackend(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'local' || normalized === 'supabase') {
    return normalized;
  }

  return null;
}

function resolveFrontendOrigins(value: string | undefined) {
  const origins = (value ?? DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : [DEFAULT_FRONTEND_ORIGIN];
}

function resolveFrontendOriginPattern(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  try {
    return new RegExp(normalized);
  } catch {
    return null;
  }
}

export const appConfig = registerAs('app', () => ({
  nodeEnv: resolveNodeEnv(process.env.NODE_ENV),
  port: resolvePort(process.env.PORT),
  frontendOrigins: resolveFrontendOrigins(process.env.FRONTEND_ORIGIN),
  frontendOriginPattern: resolveFrontendOriginPattern(process.env.FRONTEND_ORIGIN_PATTERN),
  attachmentStorageBackend:
    resolveAttachmentStorageBackend(process.env.ATTACHMENT_STORAGE_BACKEND) ??
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? 'supabase'
      : resolveNodeEnv(process.env.NODE_ENV) === 'production'
        ? 'supabase'
        : 'local'),
  attachmentLocalStoragePath:
    resolveOptionalString(process.env.ATTACHMENT_LOCAL_STORAGE_PATH) ?? 'uploads',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/vehicle_vault?schema=public',
  mailFrom: resolveOptionalString(process.env.MAIL_FROM) ?? resolveOptionalString(process.env.SMTP_FROM),
  mailReplyTo: resolveOptionalString(process.env.MAIL_REPLY_TO),
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'vehicle-vault-attachments',
  supabaseUrl: process.env.SUPABASE_URL,
  smtpHost: resolveOptionalString(process.env.SMTP_HOST),
  smtpPass: resolveOptionalString(process.env.SMTP_PASS),
  smtpPort: resolvePositiveInteger(process.env.SMTP_PORT, 587),
  smtpSecure: resolveBoolean(process.env.SMTP_SECURE, process.env.SMTP_PORT?.trim() === '465'),
  smtpUrl: resolveOptionalString(process.env.SMTP_URL),
  smtpUser: resolveOptionalString(process.env.SMTP_USER),
  jwtSecret: process.env.JWT_SECRET ?? 'vehicle-vault-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'vehicle-vault-dev-refresh-secret',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  geminiApiKey: process.env.GEMINI_API_KEY,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'noreply@vehiclevault.com',
  },
}));
