import { registerAs } from '@nestjs/config';

import { DEFAULT_APP_PORT, DEFAULT_FRONTEND_ORIGIN } from '../common/constants/app.constants';
import type { NodeEnv } from '../common/types/node-env.type';
import type { RateLimitPolicy } from '../common/rate-limit/rate-limit.types';

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

/**
 * `limit/windowSeconds`, e.g. `5/60`. A value that does not parse keeps the
 * default rather than failing boot: a typo in a rate limit should not take the
 * API down. `RateLimitService` logs the limits in effect at startup, which is
 * where a value that fell back shows up.
 */
function resolveRateLimit(value: string | undefined, fallback: RateLimitPolicy): RateLimitPolicy {
  const match = value?.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return fallback;

  const limit = Number(match[1]);
  const windowSeconds = Number(match[2]);
  return limit > 0 && windowSeconds > 0 ? { limit, windowSeconds } : fallback;
}

/**
 * Passed straight to Express's `trust proxy`. Off unless set: behind no proxy,
 * honouring `X-Forwarded-For` would let any client pick the IP it is limited
 * by. `true`, a hop count, or a comma-separated list of addresses / subnets.
 */
function resolveTrustProxy(value: string | undefined): boolean | number | string {
  const normalized = value?.trim();
  if (!normalized) return false;

  const lowered = normalized.toLowerCase();
  if (['true', 'yes', 'on'].includes(lowered)) return true;
  if (['false', 'no', 'off'].includes(lowered)) return false;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return normalized;
}

function resolveFrontendOrigins(value: string | undefined) {
  const origins = (value ?? DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : [DEFAULT_FRONTEND_ORIGIN];
}

function resolveAdminEmails(value: string | undefined) {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
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
  apiPublicUrl: resolveOptionalString(process.env.API_PUBLIC_URL),
  trustProxy: resolveTrustProxy(process.env.TRUST_PROXY),
  // Off under test so no unit or e2e run trips over its own requests; on
  // everywhere else unless explicitly disabled.
  rateLimitEnabled: resolveBoolean(
    process.env.RATE_LIMIT_ENABLED,
    resolveNodeEnv(process.env.NODE_ENV) !== 'test',
  ),
  rateLimits: {
    login: resolveRateLimit(process.env.RATE_LIMIT_LOGIN, { limit: 5, windowSeconds: 60 }),
    register: resolveRateLimit(process.env.RATE_LIMIT_REGISTER, { limit: 5, windowSeconds: 60 }),
    mail: resolveRateLimit(process.env.RATE_LIMIT_MAIL, { limit: 3, windowSeconds: 900 }),
    token: resolveRateLimit(process.env.RATE_LIMIT_TOKEN, { limit: 20, windowSeconds: 60 }),
  },
  adminEmails: resolveAdminEmails(process.env.ADMIN_EMAILS),
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
  mailFrom:
    resolveOptionalString(process.env.MAIL_FROM) ?? resolveOptionalString(process.env.SMTP_FROM),
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
  oauthGoogleClientId: resolveOptionalString(process.env.GOOGLE_OAUTH_CLIENT_ID),
  oauthGoogleClientSecret: resolveOptionalString(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
  oauthGoogleCallbackUrl: resolveOptionalString(process.env.GOOGLE_OAUTH_CALLBACK_URL),
  oauthGithubClientId: resolveOptionalString(process.env.GITHUB_OAUTH_CLIENT_ID),
  oauthGithubClientSecret: resolveOptionalString(process.env.GITHUB_OAUTH_CLIENT_SECRET),
  oauthGithubCallbackUrl: resolveOptionalString(process.env.GITHUB_OAUTH_CALLBACK_URL),
  oauthFrontendRedirectUrl: resolveOptionalString(process.env.OAUTH_FRONTEND_REDIRECT_URL),
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: resolveOptionalString(process.env.GEMINI_MODEL) ?? 'gemini-2.5-flash',
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'no-reply@middle-earth.in',
  },
}));
