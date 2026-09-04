import { describe, expect, it } from 'vitest';

import {
  calendarDaysUntil,
  formatKm,
  formatOdometerDue,
  formatRelativeDue,
  urgencyLabel,
} from './format-due';

const dueDate = '2026-04-02T00:00:00.000Z';

describe('formatRelativeDue', () => {
  it('describes reminders by calendar distance', () => {
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: 0, dueDate })).toBe('Due today');
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: 1, dueDate })).toBe('Due tomorrow');
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: 12, dueDate })).toBe(
      'Due in 12 days',
    );
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: 30, dueDate })).toBe(
      'Due in 30 days',
    );
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: 31, dueDate })).toBe(
      'Due 02 Apr 2026',
    );
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: -1, dueDate })).toBe(
      '1 day overdue',
    );
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: -3, dueDate })).toBe(
      '3 days overdue',
    );
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: -30, dueDate })).toBe(
      '30 days overdue',
    );
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: -31, dueDate })).toBe(
      'Overdue since 02 Apr 2026',
    );
  });

  it('describes documents with expiry wording', () => {
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: -10, dueDate })).toBe(
      'Expired 10 days ago',
    );
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: -1, dueDate })).toBe(
      'Expired 1 day ago',
    );
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: -45, dueDate })).toBe(
      'Expired 02 Apr 2026',
    );
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: 0, dueDate })).toBe(
      'Expires today',
    );
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: 1, dueDate })).toBe(
      'Expires tomorrow',
    );
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: 7, dueDate })).toBe(
      'Expires in 7 days',
    );
  });

  it('describes loan EMIs like dated reminders', () => {
    expect(formatRelativeDue({ kind: 'loan_emi', daysUntilDue: 0, dueDate })).toBe('Due today');
    expect(formatRelativeDue({ kind: 'loan_emi', daysUntilDue: 1, dueDate })).toBe(
      'Due tomorrow',
    );
    expect(formatRelativeDue({ kind: 'loan_emi', daysUntilDue: 5, dueDate })).toBe(
      'Due in 5 days',
    );
  });

  it('falls back to the odometer for odometer-only reminders', () => {
    expect(
      formatRelativeDue({
        kind: 'reminder',
        daysUntilDue: null,
        dueDate: null,
        dueOdometer: 45000,
        kmUntilDue: 800,
      }),
    ).toBe('Due at 45,000 km · 800 km to go');
    expect(
      formatRelativeDue({
        kind: 'reminder',
        daysUntilDue: null,
        dueDate: null,
        dueOdometer: 45000,
        kmUntilDue: -1200,
      }),
    ).toBe('Due at 45,000 km · 1,200 km past due');
    expect(
      formatRelativeDue({ kind: 'reminder', daysUntilDue: null, dueDate: null, dueOdometer: 45000 }),
    ).toBe('Due at 45,000 km');
  });

  it('prefers the date when both a date and odometer exist', () => {
    expect(
      formatRelativeDue({
        kind: 'reminder',
        daysUntilDue: 3,
        dueDate,
        dueOdometer: 45000,
        kmUntilDue: 800,
      }),
    ).toBe('Due in 3 days');
  });

  it('uses the absolute date when the day distance is unknown', () => {
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: null, dueDate })).toBe(
      'Due 02 Apr 2026',
    );
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: null, dueDate })).toBe(
      'Expires 02 Apr 2026',
    );
  });
});

describe('formatKm / formatOdometerDue', () => {
  it('formats kilometres with en-IN grouping', () => {
    expect(formatKm(123456)).toBe('1,23,456 km');
    expect(formatOdometerDue(60000, 0)).toBe('Due at 60,000 km · 0 km to go');
  });
});

describe('calendarDaysUntil', () => {
  it('counts whole UTC calendar days regardless of time of day', () => {
    expect(calendarDaysUntil('2026-04-05T23:59:00.000Z', '2026-04-02T00:01:00.000Z')).toBe(3);
    expect(calendarDaysUntil('2026-03-30T00:00:00.000Z', '2026-04-02T12:00:00.000Z')).toBe(-3);
    expect(calendarDaysUntil('2026-04-02T01:00:00.000Z', '2026-04-02T23:00:00.000Z')).toBe(0);
  });
});

describe('urgencyLabel', () => {
  it('maps every urgency to a group label', () => {
    expect(urgencyLabel('overdue')).toBe('Overdue');
    expect(urgencyLabel('today')).toBe('Today');
    expect(urgencyLabel('this_week')).toBe('This week');
    expect(urgencyLabel('this_month')).toBe('Next 30 days');
  });
});
