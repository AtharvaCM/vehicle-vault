import { describe, expect, it } from 'vitest';

import { resolveAppEnv } from './env';

describe('resolveAppEnv', () => {
  it('uses the configured API base URL when present', () => {
    expect(
      resolveAppEnv({
        PROD: true,
        VITE_API_BASE_URL: 'https://vehiclevault.middle-earth.in/api/',
      }),
    ).toEqual({
      apiBaseUrl: 'https://vehiclevault.middle-earth.in/api',
    });
  });

  it('falls back to the local API in development', () => {
    expect(
      resolveAppEnv({
        PROD: false,
      }),
    ).toEqual({
      apiBaseUrl: 'http://localhost:3001/api',
    });
  });

  it('throws when the production build is missing an API base URL', () => {
    expect(() =>
      resolveAppEnv({
        PROD: true,
      }),
    ).toThrowError(
      'Missing VITE_API_BASE_URL for the production web build. Set it explicitly for the deployed environment.',
    );
  });
});
