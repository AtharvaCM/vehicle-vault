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

export const appConfig = registerAs('app', () => ({
  nodeEnv: resolveNodeEnv(process.env.NODE_ENV),
  port: resolvePort(process.env.PORT),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN,
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/vehicle_vault?schema=public',
}));
