import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitedException } from './rate-limited.exception';
import { RATE_LIMIT_BUCKET } from './rate-limit.types';

class AuthController {
  register() {}
  getMe() {}
}
Reflect.defineMetadata(RATE_LIMIT_BUCKET, 'register', AuthController.prototype.register);

const contextFor = (handler: () => void, ip = '203.0.113.7') =>
  ({
    getHandler: () => handler,
    getClass: () => AuthController,
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  }) as never;

describe('RateLimitGuard', () => {
  const rateLimit = { hit: vi.fn() };
  const guard = new RateLimitGuard(new Reflector(), rateLimit as never);

  it('leaves a route without @RateLimit alone, without counting anything', () => {
    expect(guard.canActivate(contextFor(AuthController.prototype.getMe))).toBe(true);
    expect(rateLimit.hit).not.toHaveBeenCalled();
  });

  it('counts a decorated route per client IP, scoped to that endpoint', () => {
    rateLimit.hit.mockReturnValue({ limited: false });

    expect(guard.canActivate(contextFor(AuthController.prototype.register))).toBe(true);
    expect(rateLimit.hit).toHaveBeenCalledWith(
      'register',
      '203.0.113.7',
      'register:AuthController.register',
    );
  });

  it('refuses with a 429 that carries the retry delay', () => {
    rateLimit.hit.mockReturnValue({ limited: true, retryAfterSeconds: 42 });

    let thrown: unknown;
    try {
      guard.canActivate(contextFor(AuthController.prototype.register));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RateLimitedException);
    expect((thrown as RateLimitedException).getStatus()).toBe(429);
    expect((thrown as RateLimitedException).retryAfterSeconds).toBe(42);
  });
});
