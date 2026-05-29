import { describe, expect, it } from 'vitest';

import { formatAuditAction, formatResourceType } from './format-audit-action';

describe('formatAuditAction', () => {
  it('renders known domain actions as human labels', () => {
    expect(formatAuditAction('vehicle.created')).toEqual({
      label: 'Vehicle created',
      tone: 'accent',
    });
    expect(formatAuditAction('maintenance.deleted')).toEqual({
      label: 'Maintenance deleted',
      tone: 'danger',
    });
    expect(formatAuditAction('reminder.completed')).toEqual({
      label: 'Reminder completed',
      tone: 'accent',
    });
  });

  it('maps auth actions to friendly labels', () => {
    expect(formatAuditAction('auth.login_succeeded').label).toBe('Account signed in');
    expect(formatAuditAction('auth.login_failed')).toEqual({
      label: 'Account sign-in failed',
      tone: 'danger',
    });
  });

  it('falls back to a humanised label for unknown actions', () => {
    expect(formatAuditAction('widget.frobnicated')).toEqual({
      label: 'widget frobnicated',
      tone: 'neutral',
    });
  });

  it('formats resource types and passes null through', () => {
    expect(formatResourceType('maintenance_record')).toBe('Maintenance record');
    expect(formatResourceType(null)).toBeNull();
  });
});
