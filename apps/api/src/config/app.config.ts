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

function resolveFrontendOrigins(value: string | undefined) {
  const origins = (value ?? DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : [DEFAULT_FRONTEND_ORIGIN];
}

export const appConfig = registerAs('app', () => ({
  nodeEnv: resolveNodeEnv(process.env.NODE_ENV),
  port: resolvePort(process.env.PORT),
  frontendOrigins: resolveFrontendOrigins(process.env.FRONTEND_ORIGIN),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/vehicle_vault?schema=public',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'vehicle-vault-attachments',
  supabaseUrl: process.env.SUPABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? 'vehicle-vault-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'vehicle-vault-dev-refresh-secret',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
}));
