export type AppEnv = {
  apiBaseUrl: string;
  /** Empty string means error reporting stays off. */
  sentryDsn: string;
};

let cachedEnv: AppEnv | null = null;

type AppEnvSource = {
  PROD?: boolean;
  VITE_API_BASE_URL?: string;
  VITE_SENTRY_DSN?: string;
};

export function resolveAppEnv(env: AppEnvSource): AppEnv {
  const configuredApiBaseUrl = env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';
  const sentryDsn = env.VITE_SENTRY_DSN?.trim() ?? '';

  if (configuredApiBaseUrl) {
    return {
      apiBaseUrl: configuredApiBaseUrl,
      sentryDsn,
    };
  }

  if (env.PROD) {
    throw new Error(
      'Missing VITE_API_BASE_URL for the production web build. Set it explicitly for the deployed environment.',
    );
  }

  return {
    apiBaseUrl: 'http://localhost:3001/api',
    sentryDsn,
  };
}

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = resolveAppEnv(import.meta.env);

  return cachedEnv;
}
