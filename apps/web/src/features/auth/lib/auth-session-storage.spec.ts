import { afterEach, describe, expect, it } from 'vitest';

import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession,
} from './auth-session-storage';

describe('authSessionStorage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('stores and retrieves the auth session', () => {
    setStoredAuthSession({
      accessToken: 'jwt-token',
      user: {
        id: 'user-1',
        name: 'Atharva',
        email: 'atharva@example.com',
      },
    });

    expect(getStoredAuthSession()).toEqual({
      accessToken: 'jwt-token',
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
