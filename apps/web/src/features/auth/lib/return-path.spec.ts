import { toSafeReturnPath } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { saveCatalogIntent } from '@/features/catalog-intent/lib/catalog-intent';

import {
  afterAuthDestination,
  loginHrefReturningTo,
  validateReturnPathSearch,
} from './return-path';

describe('toSafeReturnPath', () => {
  it('keeps same-origin paths, with their search and hash', () => {
    for (const path of [
      '/dashboard',
      '/vehicles/2b1f0d4e-8c1a-4b0e-9d61-0f6a3c1e7a52',
      '/vehicle-invites/abc_DEF-123',
      '/reminders?status=upcoming&page=2',
      '/vehicles/abc#reminders',
      '/cars/honda/city',
    ]) {
      expect(toSafeReturnPath(path)).toBe(path);
    }
  });

  it('refuses anything that could lead off this site (open redirect)', () => {
    for (const value of [
      'https://evil.example.test/',
      'http://evil.example.test',
      '//evil.example.test',
      '//evil.example.test/dashboard',
      '///evil.example.test',
      '/\\evil.example.test',
      '\\\\evil.example.test',
      '/\\/evil.example.test',
      '/\t/evil.example.test',
      '/\n/evil.example.test',
      '/ /evil.example.test',
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'evil.example.test',
      'dashboard',
      '',
      ' /dashboard',
      '/./evil',
      '/../dashboard',
      '/vehicles/%2e%2e/dashboard',
      '/vehicles//evil.example.test',
      `/${'a'.repeat(600)}`,
    ]) {
      expect(toSafeReturnPath(value), JSON.stringify(value)).toBeUndefined();
    }
  });

  it('refuses the signed-out auth pages, which would loop or strand the visitor', () => {
    for (const value of [
      '/login',
      '/login?next=/dashboard',
      '/Login/',
      '/register',
      '/register?catalog=/cars/honda/city',
      '/forgot-password',
      '/reset-password?token=abc',
      '/verify-email?token=abc',
      '/auth/oauth-callback',
    ]) {
      expect(toSafeReturnPath(value), value).toBeUndefined();
    }
  });

  it('refuses values that are not strings', () => {
    for (const value of [undefined, null, 42, ['/dashboard'], { next: '/dashboard' }]) {
      expect(toSafeReturnPath(value)).toBeUndefined();
    }
  });
});

describe('validateReturnPathSearch', () => {
  it('keeps a safe next and drops anything else', () => {
    expect(validateReturnPathSearch({ next: '/reminders' })).toEqual({ next: '/reminders' });
    expect(validateReturnPathSearch({ next: '//evil.example.test' })).toEqual({});
    expect(validateReturnPathSearch({})).toEqual({});
  });
});

describe('afterAuthDestination', () => {
  beforeEach(() => localStorage.clear());

  it('goes back to the return path, even with a catalog intent waiting', () => {
    saveCatalogIntent({ segment: 'cars', make: 'honda', model: 'city' });

    expect(afterAuthDestination('/vehicle-invites/tok-1')).toEqual({
      href: '/vehicle-invites/tok-1',
    });
  });

  it('falls back to the catalog intent, then the dashboard, when there is no return path', () => {
    expect(afterAuthDestination(undefined)).toEqual({ to: '/dashboard' });
    expect(afterAuthDestination('https://evil.example.test')).toEqual({ to: '/dashboard' });

    saveCatalogIntent({ segment: 'cars', make: 'honda', model: 'city' });

    expect(afterAuthDestination(undefined)).toEqual({ to: '/vehicles/new' });
  });
});

describe('loginHrefReturningTo', () => {
  it('carries the page the session ended on', () => {
    expect(loginHrefReturningTo({ pathname: '/reminders', search: '?page=2', hash: '' })).toBe(
      `/login?next=${encodeURIComponent('/reminders?page=2')}`,
    );
  });

  it('carries nothing from a signed-out page', () => {
    expect(loginHrefReturningTo({ pathname: '/verify-email', search: '?token=x', hash: '' })).toBe(
      '/login',
    );
  });
});
