/** Metadata key `@RateLimit` writes and `RateLimitGuard` reads. */
export const RATE_LIMIT_BUCKET = 'rateLimitBucket';

/**
 * A policy, not a counter: endpoints that share a bucket share its limits but
 * are counted separately, so a burst of refreshes cannot use up the budget for
 * accepting an invite.
 *
 * - `login`, `register` — credential stuffing and account farming.
 * - `mail` — anything that sends an email to an address the caller typed in,
 *   which is how an API becomes someone else's mail bomb.
 * - `token` — endpoints that exchange a token; guessing one is hopeless, so
 *   this is loose and exists to cap volume rather than to stop anyone.
 */
export type RateLimitBucket = 'login' | 'register' | 'mail' | 'token';

export type RateLimitPolicy = { limit: number; windowSeconds: number };

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };
