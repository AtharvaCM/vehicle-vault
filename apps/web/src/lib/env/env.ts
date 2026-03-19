export type AppEnv = {
  apiBaseUrl: string;
};

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const defaultApiBaseUrl = import.meta.env.PROD
    ? 'https://vehiclevault.middle-earth.in/api'
    : 'http://localhost:3001/api';

  cachedEnv = {
    apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).trim().replace(/\/$/, ''),
  };

  return cachedEnv;
}
