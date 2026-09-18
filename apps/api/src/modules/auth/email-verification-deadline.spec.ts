import { describe, expect, it } from 'vitest';

import {
  EMAIL_VERIFICATION_GRACE_DAYS,
  getEmailVerificationDueAt,
} from './email-verification-deadline';

const createdAt = '2026-09-19T10:30:00.000Z';

describe('getEmailVerificationDueAt', () => {
  it('gives an unverified account the grace period from the moment it was created', () => {
    expect(EMAIL_VERIFICATION_GRACE_DAYS).toBe(7);
    expect(
      getEmailVerificationDueAt({ email: 'new@example.com', emailVerified: false, createdAt }),
    ).toBe('2026-09-26T10:30:00.000Z');
  });

  it('accepts the Date a Prisma row carries as well as the string the schema does', () => {
    expect(
      getEmailVerificationDueAt({
        email: 'new@example.com',
        emailVerified: false,
        createdAt: new Date(createdAt),
      }),
    ).toBe('2026-09-26T10:30:00.000Z');
  });

  it('has no deadline once the address is verified', () => {
    expect(
      getEmailVerificationDueAt({ email: 'new@example.com', emailVerified: true, createdAt }),
    ).toBeNull();
  });

  it('never asks an OAuth account without an email to verify the placeholder it was given', () => {
    // There is no inbox behind this address, so a wall would lock the account for good.
    expect(
      getEmailVerificationDueAt({
        email: 'github-4242@oauth.local',
        emailVerified: false,
        createdAt,
      }),
    ).toBeNull();
    expect(
      getEmailVerificationDueAt({
        email: 'GITHUB-4242@OAUTH.LOCAL',
        emailVerified: false,
        createdAt,
      }),
    ).toBeNull();
  });

  it('still asks an address that merely mentions the placeholder domain', () => {
    expect(
      getEmailVerificationDueAt({
        email: 'someone@oauth.local.example.com',
        emailVerified: false,
        createdAt,
      }),
    ).toBe('2026-09-26T10:30:00.000Z');
  });
});
