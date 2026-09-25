import { describe, expect, it } from 'vitest';

import { describeUserAgent, locationFrom, sessionContextFrom } from './session-context';

describe('describeUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Chrome on macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Safari on iPhone',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0 Mobile/15E148 Safari/604.1',
      'Chrome on iPhone',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      'Samsung Internet on Android',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
      'Edge on Windows',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0', 'Firefox on Linux'],
  ])('reads %s', (userAgent, expected) => {
    expect(describeUserAgent(userAgent)).toBe(expected);
  });

  it('says nothing for a session carried over without one, and admits one it cannot read', () => {
    expect(describeUserAgent(null)).toBeNull();
    expect(describeUserAgent('curl/8.4.0')).toBe('Unknown device');
  });
});

describe('locationFrom', () => {
  it("builds a place from Cloudflare's visitor-location headers", () => {
    expect(
      locationFrom({
        headers: { 'cf-ipcity': 'Pune', 'cf-region': 'Maharashtra', 'cf-ipcountry': 'IN' },
      }),
    ).toBe('Pune, Maharashtra, India');
    expect(locationFrom({ headers: { 'cf-ipcountry': 'in' } })).toBe('India');
  });

  it('is null without headers, or for an unknown or Tor country', () => {
    expect(locationFrom({ headers: {} })).toBeNull();
    expect(locationFrom({})).toBeNull();
    expect(locationFrom({ headers: { 'cf-ipcountry': 'XX' } })).toBeNull();
    expect(locationFrom({ headers: { 'cf-ipcountry': 'T1' } })).toBeNull();
  });
});

describe('sessionContextFrom', () => {
  it('keeps the user agent, cut to fit its column', () => {
    const context = sessionContextFrom({ headers: { 'user-agent': 'x'.repeat(500) } });
    expect(context.userAgent).toHaveLength(400);
    expect(context.location).toBeNull();
  });
});
