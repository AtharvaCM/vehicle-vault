import { describe, expect, it } from 'vitest';

import { formatAuditAction, formatResourceType } from './format-audit-action';

describe('formatAuditAction', () => {
  it('renders known domain actions as human labels', () => {
    expect(formatAuditAction('vehicle.created')).toEqual({
      label: 'Vehicle created',
      tone: 'accent',
    });
    expect(formatAuditAction('maintenance.deleted')).toEqual({
      label: 'Service deleted',
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

  it('names notification preference changes', () => {
    expect(formatAuditAction('notification.preferences_updated').label).toBe(
      'Notification preferences updated',
    );
    expect(formatAuditAction('notification.alert_email_muted').label).toBe(
      'Notification emails turned off',
    );
  });

  it('falls back to a humanised label for unknown actions', () => {
    expect(formatAuditAction('widget.frobnicated')).toEqual({
      label: 'widget frobnicated',
      tone: 'neutral',
    });
  });

  it('formats resource types and passes null through', () => {
    expect(formatResourceType('maintenance_record')).toBe('Service record');
    expect(formatResourceType(null)).toBeNull();
  });
});
