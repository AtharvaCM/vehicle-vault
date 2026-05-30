import { describe, expect, it } from 'vitest';

import { vi } from 'vitest';

import {
  AuditCoverageError,
  AuditCoverageScope,
  DEFAULT_EXEMPT_MODELS,
  shouldEnableSafetyNet,
  wrapTransactionForAudit,
} from './audit-coverage';

describe('AuditCoverageScope', () => {
  it('flags an audited mutation when the transaction emitted no audit event', () => {
    const scope = new AuditCoverageScope();

    scope.recordOperation('Vehicle', 'update');

    expect(scope.violations()).toEqual(['Vehicle']);
  });

  it('clears the violation when the transaction also wrote an audit event', () => {
    const scope = new AuditCoverageScope();

    scope.recordOperation('Vehicle', 'update');
    scope.recordOperation('AuditEvent', 'create');

    expect(scope.violations()).toEqual([]);
  });

  it('does not require audit for exempt system/reference models', () => {
    const scope = new AuditCoverageScope();

    scope.recordOperation('VehicleCatalogMake', 'create');
    scope.recordOperation('Notification', 'update');
    scope.recordOperation('ServiceInterval', 'update');

    expect(scope.violations()).toEqual([]);
  });

  it('exposes the default exempt set including catalog and audit models', () => {
    expect(DEFAULT_EXEMPT_MODELS).toContain('AuditEvent');
    expect(DEFAULT_EXEMPT_MODELS).toContain('VehicleCatalogMake');
    expect(DEFAULT_EXEMPT_MODELS).not.toContain('Vehicle');
  });

  it('ignores read operations', () => {
    const scope = new AuditCoverageScope();

    scope.recordOperation('Vehicle', 'findMany');
    scope.recordOperation('Vehicle', 'findUnique');

    expect(scope.violations()).toEqual([]);
  });

  it('treats one audit write as covering multiple audited mutations in the tx', () => {
    const scope = new AuditCoverageScope();

    scope.recordOperation('Claim', 'create');
    scope.recordOperation('Attachment', 'create');
    scope.recordOperation('AuditEvent', 'create');

    expect(scope.violations()).toEqual([]);
  });

  it('reports each distinct unaudited model once', () => {
    const scope = new AuditCoverageScope();

    scope.recordOperation('Reminder', 'update');
    scope.recordOperation('Reminder', 'update');
    scope.recordOperation('FuelLog', 'delete');

    expect(scope.violations().sort()).toEqual(['FuelLog', 'Reminder']);
  });

  it('throwIfViolations raises AuditCoverageError naming the models', () => {
    const scope = new AuditCoverageScope();
    scope.recordOperation('Vehicle', 'update');

    expect(() => scope.throwIfViolations()).toThrowError(AuditCoverageError);
    try {
      scope.throwIfViolations();
    } catch (error) {
      expect((error as AuditCoverageError).models).toEqual(['Vehicle']);
    }
  });

  it('throwIfViolations is a no-op when coverage is satisfied', () => {
    const scope = new AuditCoverageScope();
    scope.recordOperation('Vehicle', 'update');
    scope.recordOperation('AuditEvent', 'create');

    expect(() => scope.throwIfViolations()).not.toThrow();
  });
});

describe('shouldEnableSafetyNet', () => {
  it('is disabled in production', () => {
    expect(shouldEnableSafetyNet('production')).toBe(false);
  });

  it('is enabled in development, test, and when NODE_ENV is unset', () => {
    expect(shouldEnableSafetyNet('development')).toBe(true);
    expect(shouldEnableSafetyNet('test')).toBe(true);
    expect(shouldEnableSafetyNet(undefined)).toBe(true);
  });
});

describe('wrapTransactionForAudit', () => {
  it('records mutations on the wrapped client and delegates to the real tx', async () => {
    const scope = new AuditCoverageScope();
    const update = vi.fn().mockResolvedValue('updated');
    const tx = { vehicle: { update } };

    const wrapped = wrapTransactionForAudit(tx, scope);
    const result = await wrapped.vehicle.update({ where: { id: '1' } });

    expect(result).toBe('updated');
    expect(update).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(scope.violations()).toEqual(['Vehicle']);
  });

  it('treats auditEvent.create on the wrapped client as the audit write', async () => {
    const scope = new AuditCoverageScope();
    const tx = {
      claim: { create: vi.fn().mockResolvedValue('c') },
      auditEvent: { create: vi.fn().mockResolvedValue('a') },
    };

    const wrapped = wrapTransactionForAudit(tx, scope);
    await wrapped.claim.create({});
    await wrapped.auditEvent.create({});

    expect(scope.violations()).toEqual([]);
  });

  it('passes through client-level methods like $queryRaw untouched', () => {
    const scope = new AuditCoverageScope();
    const queryRaw = vi.fn();
    const tx = { $queryRaw: queryRaw };

    const wrapped = wrapTransactionForAudit(tx, scope);

    expect(wrapped.$queryRaw).toBe(queryRaw);
  });
});

describe('AuditCoverageError', () => {
  it('names the offending models in its message', () => {
    const error = new AuditCoverageError(['Vehicle', 'Claim']);

    expect(error).toBeInstanceOf(Error);
    expect(error.models).toEqual(['Vehicle', 'Claim']);
    expect(error.message).toContain('Vehicle');
    expect(error.message).toContain('Claim');
  });
});
