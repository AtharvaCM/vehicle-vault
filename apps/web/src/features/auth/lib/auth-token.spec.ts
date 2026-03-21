import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAccessTokenExpiryEpochMs,
  getAccessTokenPayload,
  hasAccessTokenExpiry,
  isAccessTokenExpired,
} from './auth-token';

function createToken(payload: Record<string, unknown>) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return `${encode(header)}.${encode(payload)}.signature`;
}

describe('authToken', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses the JWT payload and expiry timestamp', () => {
    const token = createToken({
      sub: 'user-1',
      exp: 1_900_000_000,
    });

    expect(getAccessTokenPayload(token)).toMatchObject({
      sub: 'user-1',
      exp: 1_900_000_000,
    });
    expect(getAccessTokenExpiryEpochMs(token)).toBe(1_900_000_000_000);
    expect(hasAccessTokenExpiry(token)).toBe(true);
  });

  it('treats tokens near expiry as expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'));

    const token = createToken({
      exp: Math.floor((Date.now() + 20_000) / 1000),
    });

    expect(isAccessTokenExpired(token)).toBe(true);
  });

  it('returns null for malformed tokens instead of throwing', () => {
    expect(getAccessTokenPayload('not-a-token')).toBeNull();
    expect(getAccessTokenExpiryEpochMs('not-a-token')).toBeNull();
    expect(hasAccessTokenExpiry('not-a-token')).toBe(false);
    expect(isAccessTokenExpired('not-a-token')).toBe(false);
  });
});
