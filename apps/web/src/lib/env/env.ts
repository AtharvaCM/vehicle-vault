export type AppEnv = {
  apiBaseUrl: string;
};

let cachedEnv: AppEnv | null = null;

type AppEnvSource = {
  PROD?: boolean;
  VITE_API_BASE_URL?: string;
};

export function resolveAppEnv(env: AppEnvSource): AppEnv {
  const configuredApiBaseUrl = env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';

  if (configuredApiBaseUrl) {
    return {
      apiBaseUrl: configuredApiBaseUrl,
    };
  }

  if (env.PROD) {
    throw new Error(
      'Missing VITE_API_BASE_URL for the production web build. Set it explicitly for the deployed environment.',
    );
  }

  return {
    apiBaseUrl: 'http://localhost:3001/api',
  };
}

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = resolveAppEnv(import.meta.env);

  return cachedEnv;
}
