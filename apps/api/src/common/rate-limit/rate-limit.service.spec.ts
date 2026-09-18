import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RateLimitService } from './rate-limit.service';

const T0 = new Date('2026-09-18T12:00:00.000Z');

describe('RateLimitService', () => {
  const config = {
    rateLimitEnabled: true,
    rateLimits: {
      login: { limit: 3, windowSeconds: 60 },
      register: { limit: 5, windowSeconds: 60 },
      mail: { limit: 2, windowSeconds: 900 },
      token: { limit: 20, windowSeconds: 60 },
    },
  };

  let service: RateLimitService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    config.rateLimitEnabled = true;
    service = new RateLimitService(config as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const hitTimes = (count: number, bucket: 'login' | 'mail' = 'login', ip = '203.0.113.7') =>
    Array.from({ length: count }, () => service.hit(bucket, ip));

  it('lets a client through up to the limit', () => {
    expect(hitTimes(3).every((result) => !result.limited)).toBe(true);
  });

  it('refuses the next hit and says when to come back', () => {
    hitTimes(3);
    vi.advanceTimersByTime(20_000);

    expect(service.hit('login', '203.0.113.7')).toEqual({ limited: true, retryAfterSeconds: 40 });
  });

  it('slides: the oldest hit leaving the window frees exactly one slot', () => {
    service.hit('login', '203.0.113.7');
    vi.advanceTimersByTime(30_000);
    service.hit('login', '203.0.113.7');
    service.hit('login', '203.0.113.7');

    vi.advanceTimersByTime(30_001);
    expect(service.hit('login', '203.0.113.7').limited).toBe(false);
    expect(service.hit('login', '203.0.113.7').limited).toBe(true);
  });

  it('does not count refused hits against the client, so waiting it out works', () => {
    // Otherwise a client that keeps retrying would never get back under.
    hitTimes(3);
    hitTimes(10);

    vi.advanceTimersByTime(60_001);
    expect(service.hit('login', '203.0.113.7').limited).toBe(false);
  });

  it('counts each client separately', () => {
    hitTimes(3, 'login', '203.0.113.7');

    expect(service.hit('login', '198.51.100.9').limited).toBe(false);
  });

  it('counts each scope separately under one shared policy', () => {
    for (let i = 0; i < 2; i++)
      service.hit('mail', 'ip', 'mail:AuthController.requestPasswordReset');

    expect(service.hit('mail', 'ip', 'mail:AuthController.requestPasswordReset').limited).toBe(
      true,
    );
    expect(service.hit('mail', 'ip', 'mail:AuthController.resendVerification').limited).toBe(false);
  });

  it('uses each bucket’s own window', () => {
    hitTimes(2, 'mail');
    vi.advanceTimersByTime(10 * 60_000);

    // Ten minutes on, a 60-second bucket would long since have reset.
    expect(service.hit('mail', '203.0.113.7')).toEqual({ limited: true, retryAfterSeconds: 300 });
  });

  it('never limits when disabled, as under test', () => {
    config.rateLimitEnabled = false;

    expect(hitTimes(50).some((result) => result.limited)).toBe(false);
  });

  it('forgets clients whose window has passed, so memory does not grow with every IP seen', () => {
    for (let i = 0; i < 100; i++) service.hit('login', `198.51.100.${i}`);
    vi.advanceTimersByTime(16 * 60_000);

    service.hit('login', '203.0.113.7');

    const tracked = (service as unknown as { hits: Map<string, number[]> }).hits;
    expect([...tracked.keys()]).toEqual(['login:203.0.113.7']);
  });
});
