import { afterEach, describe, expect, it } from 'vitest';

import { appConfig } from './app.config';

const KEYS = [
  'NODE_ENV',
  'TRUST_PROXY',
  'RATE_LIMIT_ENABLED',
  'RATE_LIMIT_LOGIN',
  'RATE_LIMIT_REGISTER',
  'RATE_LIMIT_MAIL',
  'RATE_LIMIT_TOKEN',
] as const;

describe('appConfig rate limiting and proxy trust', () => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const load = (env: Partial<Record<(typeof KEYS)[number], string>>) => {
    for (const key of KEYS) delete process.env[key];
    Object.assign(process.env, env);
    return appConfig();
  };

  it('ships the documented defaults', () => {
    expect(load({ NODE_ENV: 'production' }).rateLimits).toEqual({
      login: { limit: 5, windowSeconds: 60 },
      register: { limit: 5, windowSeconds: 60 },
      mail: { limit: 3, windowSeconds: 900 },
      token: { limit: 20, windowSeconds: 60 },
    });
  });

  it('is on everywhere but under test, where it is off', () => {
    expect(load({ NODE_ENV: 'production' }).rateLimitEnabled).toBe(true);
    expect(load({ NODE_ENV: 'development' }).rateLimitEnabled).toBe(true);
    expect(load({ NODE_ENV: 'test' }).rateLimitEnabled).toBe(false);
  });

  it('can be switched either way explicitly', () => {
    expect(load({ NODE_ENV: 'production', RATE_LIMIT_ENABLED: 'false' }).rateLimitEnabled).toBe(
      false,
    );
    expect(load({ NODE_ENV: 'test', RATE_LIMIT_ENABLED: 'true' }).rateLimitEnabled).toBe(true);
  });

  it('reads limit/seconds pairs, tolerating spaces', () => {
    expect(load({ RATE_LIMIT_LOGIN: '10 / 30' }).rateLimits.login).toEqual({
      limit: 10,
      windowSeconds: 30,
    });
  });

  it('keeps the default for a value that does not parse rather than failing boot', () => {
    for (const value of ['ten/60', '5', '0/60', '5/0', '-1/60', '']) {
      expect(load({ RATE_LIMIT_MAIL: value }).rateLimits.mail).toEqual({
        limit: 3,
        windowSeconds: 900,
      });
    }
  });

  it('does not trust forwarded headers unless told to', () => {
    expect(load({}).trustProxy).toBe(false);
    expect(load({ TRUST_PROXY: 'false' }).trustProxy).toBe(false);
  });

  it('passes the proxy setting through in each form Express understands', () => {
    expect(load({ TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(load({ TRUST_PROXY: '2' }).trustProxy).toBe(2);
    expect(load({ TRUST_PROXY: 'loopback, 10.0.0.0/8' }).trustProxy).toBe('loopback, 10.0.0.0/8');
  });
});
