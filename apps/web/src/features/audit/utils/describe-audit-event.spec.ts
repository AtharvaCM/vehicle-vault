import { AUDIT_ACTION_NAMES } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { AuditEvent } from '../types/audit-event';
import { describeAuditEvent, hasSentence } from './describe-audit-event';

function event(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: 'e',
    occurredAt: '2026-09-25T10:00:00.000Z',
    action: 'vehicle.created',
    actorUserId: 'u1',
    ownerUserId: 'u1',
    resourceType: null,
    resourceId: null,
    before: null,
    after: null,
    changedFields: [],
    ipAddress: null,
    userAgent: null,
    actor: { name: 'Asha', isYou: true },
    resourceExists: null,
    ...overrides,
  };
}

describe('describeAuditEvent', () => {
  it.each(AUDIT_ACTION_NAMES)('has a sentence for %s, with no raw fallback', (action) => {
    expect(hasSentence(action)).toBe(true);
    const sentence = describeAuditEvent(event({ action, after: {}, before: {} }));
    expect(sentence.text).not.toMatch(/made a change|undefined|null|\bNaN\b/);
    expect(sentence.text).not.toContain(action);
  });

  it('reads a fill, actor first, with its figures', () => {
    const sentence = describeAuditEvent(
      event({
        action: 'fuel.created',
        actor: { name: 'Priya', isYou: false },
        resourceType: 'fuel_log',
        resourceId: 'fill-1',
        resourceExists: true,
        after: { vehicleId: 'v1', quantity: 28, totalCost: '2996', odometer: 18500 },
      }),
    );

    expect(sentence).toEqual({
      text: 'Priya logged a fuel fill',
      detail: '28 L · ₹2,996 · 18,500 km',
      link: {
        to: '/vehicles/$vehicleId',
        params: { vehicleId: 'v1' },
        search: { tab: 'history', view: 'fuel' },
      },
      suspicious: false,
    });
  });

  it('reads an expiry change as before → after', () => {
    const sentence = describeAuditEvent(
      event({
        action: 'puc.updated',
        changedFields: ['endDate', 'updatedAt'],
        before: { endDate: '2027-02-23T00:00:00.000Z' },
        after: { endDate: '2027-08-23T00:00:00.000Z' },
      }),
    );

    expect(sentence.text).toBe('You changed the PUC expiry');
    expect(sentence.detail).toBe('23 Feb 2027 → 23 Aug 2027');
  });

  it('links to a record only while it exists', () => {
    const logged = {
      action: 'maintenance.created',
      resourceType: 'maintenance_record' as const,
      resourceId: 'r1',
      after: { category: 'engine_oil', status: 'confirmed', totalCost: '1850', odometer: 18300 },
    };

    expect(describeAuditEvent(event({ ...logged, resourceExists: true })).link).toEqual({
      to: '/maintenance-records/$recordId',
      params: { recordId: 'r1' },
    });
    expect(describeAuditEvent(event({ ...logged, resourceExists: false })).link).toBeNull();
    expect(describeAuditEvent(event({ ...logged, resourceExists: true })).text).toBe(
      'You logged engine oil',
    );
  });

  it('says a draft confirmed, and a deleted service by what it was', () => {
    expect(
      describeAuditEvent(
        event({
          action: 'maintenance.updated',
          before: { status: 'draft', category: 'periodic_service' },
          after: { status: 'confirmed', category: 'periodic_service', totalCost: '6400' },
        }),
      ).text,
    ).toBe('You confirmed periodic service');
    expect(
      describeAuditEvent(
        event({ action: 'maintenance.deleted', before: { category: 'puncture' }, after: null }),
      ).text,
    ).toBe('You deleted puncture');
  });

  it('flags a failed sign-in, without blaming the account owner', () => {
    const sentence = describeAuditEvent(
      event({ action: 'auth.login_failed', after: { reason: 'bad_password' } }),
    );

    expect(sentence.text).toBe('Someone tried to sign in to your account and failed');
    expect(sentence.detail).toBe('wrong password');
    expect(sentence.suspicious).toBe(true);
  });

  it('says where a sign-in came from, and what a session change did', () => {
    expect(
      describeAuditEvent(
        event({
          action: 'auth.login_succeeded',
          after: { device: 'Chrome on macOS', location: 'Pune, India' },
        }),
      ),
    ).toMatchObject({ text: 'You signed in', detail: 'Chrome on macOS · Pune, India' });
    expect(
      describeAuditEvent(event({ action: 'auth.other_sessions_revoked', after: { count: 2 } }))
        .text,
    ).toBe('You signed out 2 other devices');
  });

  it('still reads an action from a newer API as words', () => {
    const sentence = describeAuditEvent(event({ action: 'tyre.rotated' }));
    expect(sentence.text).toBe('You made a change');
    expect(sentence.detail).toBe('tyre rotated');
  });
});
