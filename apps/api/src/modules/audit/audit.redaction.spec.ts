import { AuditResourceType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { diffChangedFields, redact } from './audit.redaction';

describe('audit.redaction', () => {
  it('replaces deny-listed user fields with the redacted sentinel', () => {
    const result = redact(AuditResourceType.user, {
      id: 'user-1',
      email: 'alice@example.com',
      passwordHash: 'super-secret-bcrypt',
      refreshTokenHash: 'sha-256-hex',
      emailVerified: true,
    });

    expect(result).toEqual({
      id: 'user-1',
      email: 'alice@example.com',
      passwordHash: '[redacted]',
      refreshTokenHash: '[redacted]',
      emailVerified: true,
    });
  });

  it('strips the insurer-issued policyNumber from InsurancePolicy payloads', () => {
    const result = redact(AuditResourceType.insurance_policy, {
      provider: 'ICICI Lombard',
      policyNumber: 'POL-12345',
      premiumAmount: '15000.00',
    });

    expect(result?.policyNumber).toBe('[redacted]');
    expect(result?.provider).toBe('ICICI Lombard');
    expect(result?.premiumAmount).toBe('15000.00');
  });

  it('serialises Date values to ISO strings for stable storage', () => {
    const occurredAt = new Date('2026-05-28T12:00:00.000Z');
    const result = redact(AuditResourceType.vehicle, { id: 'v1', createdAt: occurredAt });
    expect(result?.createdAt).toBe('2026-05-28T12:00:00.000Z');
  });

  it('returns the keys present in after when before is null', () => {
    expect(diffChangedFields(null, { name: 'Bob', email: 'b@x.com' })).toEqual(['name', 'email']);
  });

  it('returns only fields whose JSON representation differs', () => {
    const before = { make: 'Toyota', model: 'Corolla', odometer: 10000 };
    const after = { make: 'Toyota', model: 'Camry', odometer: 12000 };
    expect(diffChangedFields(before, after)).toEqual(['model', 'odometer']);
  });
});
