export type AppEnv = {
  apiBaseUrl: string;
};

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api')
      .trim()
      .replace(/\/$/, ''),
  };

  return cachedEnv;
}
