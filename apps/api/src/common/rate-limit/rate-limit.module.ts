import { Global, Module } from '@nestjs/common';

import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

/**
 * Global for the same reason as `MailModule`: the guard is attached by a
 * decorator in whichever feature module owns the route, and one shared set of
 * counters is the point.
 */
@Global()
@Module({
  providers: [RateLimitService, RateLimitGuard],
  exports: [RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}
