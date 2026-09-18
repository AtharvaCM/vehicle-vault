import { describe, expect, it } from 'vitest';

import { getVerificationStatus } from './verification-status';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const registeredAt = new Date('2026-09-19T10:00:00.000Z');
/** What the API sends for an account registered at `registeredAt`. */
const dueAt = new Date(registeredAt.getTime() + 7 * DAY_MS).toISOString();

function unverified(emailVerificationDueAt: string | null) {
  return { emailVerified: false, emailVerificationDueAt };
}

function at(msAfterRegistering: number) {
  return new Date(registeredAt.getTime() + msAfterRegistering);
}

describe('getVerificationStatus', () => {
  it('asks nothing of a verified account', () => {
    expect(
      getVerificationStatus({ emailVerified: true, emailVerificationDueAt: null }, at(0)),
    ).toEqual({ kind: 'none' });
    expect(getVerificationStatus(null, at(0))).toEqual({ kind: 'none' });
  });

  it('asks nothing of an account with no address to verify', () => {
    expect(getVerificationStatus(unverified(null), at(30 * DAY_MS))).toEqual({ kind: 'none' });
  });

  it('lets a brand-new account in with the full week to go', () => {
    expect(getVerificationStatus(unverified(dueAt), at(0))).toEqual({
      kind: 'grace',
      daysLeft: 7,
    });
  });

  it('counts part of a day as a day left', () => {
    expect(getVerificationStatus(unverified(dueAt), at(DAY_MS + HOUR_MS))).toEqual({
      kind: 'grace',
      daysLeft: 6,
    });
    expect(getVerificationStatus(unverified(dueAt), at(7 * DAY_MS - HOUR_MS))).toEqual({
      kind: 'grace',
      daysLeft: 1,
    });
  });

  it('puts the wall up from day eight', () => {
    expect(getVerificationStatus(unverified(dueAt), at(7 * DAY_MS))).toEqual({
      kind: 'required',
    });
    expect(getVerificationStatus(unverified(dueAt), at(40 * DAY_MS))).toEqual({
      kind: 'required',
    });
  });

  it('keeps the wall for a session from an API that sends no deadline', () => {
    const fromOlderApi = { emailVerified: false } as Parameters<typeof getVerificationStatus>[0];

    expect(getVerificationStatus(fromOlderApi, at(0))).toEqual({ kind: 'required' });
  });

  it('fails closed on a deadline it cannot read', () => {
    expect(getVerificationStatus(unverified('not a date'), at(0))).toEqual({ kind: 'required' });
  });
});
