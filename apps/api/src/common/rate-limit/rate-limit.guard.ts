import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RateLimitService } from './rate-limit.service';
import { RateLimitedException } from './rate-limited.exception';
import { RATE_LIMIT_BUCKET, type RateLimitBucket } from './rate-limit.types';

/**
 * Applied per route by `@RateLimit`, never globally: every endpoint without the
 * decorator is untouched.
 *
 * The client is `req.ip`, which Express derives from `X-Forwarded-For` only when
 * `trust proxy` is set (see `TRUST_PROXY`). Reading the header directly here
 * would let any caller choose the address they are counted under.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const bucket = this.reflector.get<RateLimitBucket | undefined>(
      RATE_LIMIT_BUCKET,
      context.getHandler(),
    );
    if (!bucket) return true;

    const request = context.switchToHttp().getRequest<{ ip?: string }>();
    const scope = `${bucket}:${context.getClass().name}.${context.getHandler().name}`;
    const result = this.rateLimit.hit(bucket, request.ip ?? 'unknown', scope);

    if (result.limited) throw new RateLimitedException(result.retryAfterSeconds);
    return true;
  }
}
