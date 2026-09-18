import { describe, expect, it } from 'vitest';

import { LOCAL_API_TARGET, resolveApiProxyTarget } from './api-target';

describe('resolveApiProxyTarget', () => {
  it('defaults to the local API when nothing is set', () => {
    expect(resolveApiProxyTarget({})).toBe('http://127.0.0.1:3001');
    expect(LOCAL_API_TARGET).toBe('http://127.0.0.1:3001');
  });

  it('treats a blank variable as unset rather than as a target', () => {
    expect(resolveApiProxyTarget({ E2E_API_PROXY_TARGET: '   ' })).toBe(LOCAL_API_TARGET);
  });

  it('goes wherever it is explicitly pointed, short of production', () => {
    expect(resolveApiProxyTarget({ E2E_API_PROXY_TARGET: 'https://staging.example.com' })).toBe(
      'https://staging.example.com',
    );
  });

  it('refuses the production API and says why', () => {
    expect(() =>
      resolveApiProxyTarget({ E2E_API_PROXY_TARGET: 'https://vehiclevault.middle-earth.in' }),
    ).toThrow(
      /Refusing to run the e2e suite against the production API[\s\S]*E2E_ALLOW_PRODUCTION_API=1/,
    );
  });

  it('is not fooled by case, a port, or a path', () => {
    for (const target of [
      'https://VehicleVault.Middle-Earth.in',
      'https://vehiclevault.middle-earth.in:443',
      'https://vehiclevault.middle-earth.in/api',
    ]) {
      expect(() => resolveApiProxyTarget({ E2E_API_PROXY_TARGET: target })).toThrow(/production/);
    }
  });

  it('allows production only with the explicit override', () => {
    expect(
      resolveApiProxyTarget({
        E2E_API_PROXY_TARGET: 'https://vehiclevault.middle-earth.in',
        E2E_ALLOW_PRODUCTION_API: '1',
      }),
    ).toBe('https://vehiclevault.middle-earth.in');
  });

  it('does not treat a stray value as the override', () => {
    for (const value of ['', '0', 'false', 'no', 'maybe']) {
      expect(() =>
        resolveApiProxyTarget({
          E2E_API_PROXY_TARGET: 'https://vehiclevault.middle-earth.in',
          E2E_ALLOW_PRODUCTION_API: value,
        }),
      ).toThrow(/production/);
    }
  });

  it('rejects a target without a scheme instead of handing it to the dev server', () => {
    // `new URL` accepts this, reading `localhost:` as the scheme — the case the
    // explicit http(s) check exists for.
    expect(() => resolveApiProxyTarget({ E2E_API_PROXY_TARGET: 'localhost:3001' })).toThrow(
      /must be an http\(s\) URL/,
    );
  });

  it('rejects something that is not a URL at all', () => {
    expect(() => resolveApiProxyTarget({ E2E_API_PROXY_TARGET: 'not a url' })).toThrow(
      /must be an http\(s\) URL/,
    );
  });
});
