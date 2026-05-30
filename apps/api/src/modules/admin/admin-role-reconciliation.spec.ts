import { describe, expect, it } from 'vitest';

import { computeAdminRoleReconciliation } from './admin-role-reconciliation';

describe('computeAdminRoleReconciliation', () => {
  it('promotes listed emails that are not yet admins', () => {
    const result = computeAdminRoleReconciliation({
      currentAdminEmails: [],
      desiredAdminEmails: ['owner@example.com'],
    });

    expect(result.promote).toEqual(['owner@example.com']);
    expect(result.demote).toEqual([]);
  });

  it('demotes admins whose email is no longer listed', () => {
    const result = computeAdminRoleReconciliation({
      currentAdminEmails: ['old@example.com'],
      desiredAdminEmails: [],
    });

    expect(result.promote).toEqual([]);
    expect(result.demote).toEqual(['old@example.com']);
  });

  it('leaves matching admins untouched', () => {
    const result = computeAdminRoleReconciliation({
      currentAdminEmails: ['keep@example.com'],
      desiredAdminEmails: ['keep@example.com'],
    });

    expect(result.promote).toEqual([]);
    expect(result.demote).toEqual([]);
  });

  it('is case-insensitive on both sides', () => {
    const result = computeAdminRoleReconciliation({
      currentAdminEmails: ['Keep@Example.com'],
      desiredAdminEmails: ['KEEP@example.com', 'New@Example.com'],
    });

    expect(result.promote).toEqual(['new@example.com']);
    expect(result.demote).toEqual([]);
  });
});
