import type { AuthUser } from '@vehicle-vault/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

export type VerificationStatus =
  /** Verified, or nothing to verify: neither banner nor wall. */
  | { kind: 'none' }
  /** Unverified inside the grace period: the whole app, plus a banner. */
  | { kind: 'grace'; daysLeft: number }
  /** Unverified past the deadline: the verification wall. */
  | { kind: 'required' };

/**
 * Where the signed-in user stands on email verification. The API decides the
 * deadline (`emailVerificationDueAt`); this only compares it with the clock.
 */
export function getVerificationStatus(
  user: Pick<AuthUser, 'emailVerified' | 'emailVerificationDueAt'> | null,
  now: Date = new Date(),
): VerificationStatus {
  if (!user || user.emailVerified) {
    return { kind: 'none' };
  }

  const dueAt: string | null | undefined = user.emailVerificationDueAt;

  // An API from before the grace period sends no deadline at all: keep its wall
  // rather than let the account in with nothing counting down.
  if (dueAt === undefined) {
    return { kind: 'required' };
  }

  if (dueAt === null) {
    return { kind: 'none' };
  }

  const remainingMs = Date.parse(dueAt) - now.getTime();

  // Also catches an unparsable date, which comes out as NaN.
  if (!(remainingMs > 0)) {
    return { kind: 'required' };
  }

  return { kind: 'grace', daysLeft: Math.ceil(remainingMs / DAY_MS) };
}
