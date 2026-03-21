import { afterEach, describe, expect, it } from 'vitest';

import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession,
} from './auth-session-storage';

describe('authSessionStorage', () => {
  function createToken(exp: number) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encode = (value: Record<string, unknown>) =>
      btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

    return `${encode(header)}.${encode({ exp })}.signature`;
  }

  afterEach(() => {
    window.localStorage.clear();
  });

  it('stores and retrieves the auth session', () => {
    const accessToken = createToken(Math.floor((Date.now() + 60 * 60_000) / 1000));

    setStoredAuthSession({
      accessToken,
      user: {
        id: 'user-1',
        name: 'Atharva',
        email: 'atharva@example.com',
      },
    });

    expect(getStoredAuthSession()).toEqual({
      accessToken,
      user: {
        id: 'user-1',
        name: 'Atharva',
        email: 'atharva@example.com',
      },
    });
  });

  it('clears invalid stored JSON instead of throwing', () => {
    window.localStorage.setItem('vehicle-vault.auth-session', 'not-json');

    expect(getStoredAuthSession()).toBeNull();
    expect(window.localStorage.getItem('vehicle-vault.auth-session')).toBeNull();
  });

  it('clears expired stored sessions instead of restoring them', () => {
    window.localStorage.setItem(
      'vehicle-vault.auth-session',
      JSON.stringify({
        accessToken: createToken(Math.floor((Date.now() - 60_000) / 1000)),
        user: {
          id: 'user-1',
          name: 'Atharva',
          email: 'atharva@example.com',
        },
      }),
    );

    expect(getStoredAuthSession()).toBeNull();
    expect(window.localStorage.getItem('vehicle-vault.auth-session')).toBeNull();
  });

  it('clears malformed JWT sessions instead of restoring them', () => {
    window.localStorage.setItem(
      'vehicle-vault.auth-session',
      JSON.stringify({
        accessToken: 'not-a-jwt',
        user: {
          id: 'user-1',
          name: 'Atharva',
          email: 'atharva@example.com',
        },
      }),
    );

    expect(getStoredAuthSession()).toBeNull();
    expect(window.localStorage.getItem('vehicle-vault.auth-session')).toBeNull();
  });

  it('removes the stored session on logout', () => {
    setStoredAuthSession({
      accessToken: 'jwt-token',
      user: {
        id: 'user-1',
        name: 'Atharva',
        email: 'atharva@example.com',
      },
    });

    clearStoredAuthSession();

    expect(getStoredAuthSession()).toBeNull();
  });
});
