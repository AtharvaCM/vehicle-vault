import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * A 429 that remembers when the caller may try again, so the global filter can
 * answer with a `Retry-After` header alongside the `RATE_LIMITED` code.
 */
export class RateLimitedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many requests. Try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
