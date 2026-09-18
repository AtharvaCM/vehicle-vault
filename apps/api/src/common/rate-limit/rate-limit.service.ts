import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import type { RateLimitBucket, RateLimitResult } from './rate-limit.types';

/** How often expired counters are swept, so one-off clients do not accumulate forever. */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Per-client sliding-window counters, held in memory.
 *
 * In memory because the API runs as a single container. A restart forgets
 * every counter and a second instance would count separately — both fine for
 * turning a password-guessing loop into a crawl, which is the job here. If the
 * API ever scales out, this is the thing to move to shared storage.
 *
 * A sliding log rather than fixed windows: the limits are single digits, so
 * keeping each hit's timestamp costs a handful of numbers per client, and it
 * closes the burst a fixed window allows at every boundary.
 */
@Injectable()
export class RateLimitService implements OnModuleInit {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly hits = new Map<string, number[]>();
  private lastSweep = 0;

  constructor(private readonly appConfigService: AppConfigService) {}

  /**
   * One line at boot with the limits actually in force, so an env value that
   * failed to parse — and silently fell back to the default — is visible.
   */
  onModuleInit() {
    if (!this.appConfigService.rateLimitEnabled) {
      this.logger.log('Rate limiting is disabled.');
      return;
    }

    const policies = Object.entries(this.appConfigService.rateLimits)
      .map(([bucket, { limit, windowSeconds }]) => `${bucket} ${limit}/${windowSeconds}s`)
      .join(', ');
    this.logger.log(`Rate limits per client IP: ${policies}.`);
  }

  /**
   * Record a hit for this client against the bucket's policy and say whether it
   * is over. `scope` separates endpoints that share a policy — see the bucket
   * docs — and defaults to the bucket itself.
   */
  hit(bucket: RateLimitBucket, clientKey: string, scope: string = bucket): RateLimitResult {
    if (!this.appConfigService.rateLimitEnabled) return { limited: false };

    const { limit, windowSeconds } = this.appConfigService.rateLimits[bucket];
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    this.sweep(now, windowMs);

    const key = `${scope}:${clientKey}`;
    const recent = (this.hits.get(key) ?? []).filter((at) => at > now - windowMs);

    if (recent.length >= limit) {
      this.hits.set(key, recent);
      // The oldest hit in the window is the next to expire; `limit` is at least 1.
      const oldest = recent[0] ?? now;
      const retryAfterMs = oldest + windowMs - now;
      return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }

    recent.push(now);
    this.hits.set(key, recent);
    return { limited: false };
  }

  /**
   * Drop counters with nothing left in their window. Uses the longest window any
   * bucket has, so a mail counter is never swept while it still matters.
   */
  private sweep(now: number, windowMs: number) {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;

    const longestMs = Math.max(
      windowMs,
      ...Object.values(this.appConfigService.rateLimits).map(
        (policy) => policy.windowSeconds * 1000,
      ),
    );
    for (const [key, times] of this.hits) {
      if (times.every((at) => at <= now - longestMs)) this.hits.delete(key);
    }
  }
}
