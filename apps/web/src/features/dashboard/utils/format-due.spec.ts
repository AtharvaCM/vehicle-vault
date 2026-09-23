import { describe, expect, it } from 'vitest';

import {
  formatOdometerDue,
  formatRelativeAgo,
  formatRelativeDue,
  urgencyLabel,
} from './format-due';

const dueDate = '2026-04-02T00:00:00.000Z';

describe('formatRelativeDue', () => {
  it('says when a reminder is due in words that give the time', () => {
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: 0, dueDate })).toBe('Today');
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: 1, dueDate })).toBe('Tomorrow');
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: 12, dueDate })).toBe('In 12 days');
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: 45, dueDate })).toBe('In 45 days');
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: -1, dueDate })).toBe('1 day late');
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: -3, dueDate })).toBe('3 days late');
    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: -31, dueDate })).toBe(
      '31 days late',
    );
  });

  it('describes an accessory warranty as running out, like a document', () => {
    expect(formatRelativeDue({ kind: 'accessory', daysUntilDue: 0, dueDate })).toBe('Ends today');
    expect(formatRelativeDue({ kind: 'accessory', daysUntilDue: 5, dueDate })).toBe('5 days left');
  });

  it('lets an undated verdict say what it rests on', () => {
    expect(
      formatRelativeDue({
        kind: 'tyre',
        daysUntilDue: null,
        dueDate: null,
        detail: '2.8 mm tread',
      }),
    ).toBe('2.8 mm tread');
    expect(formatRelativeDue({ kind: 'service_baseline', daysUntilDue: null, dueDate: null })).toBe(
      'No due date',
    );
  });

  it('describes documents by the days left, or the day they ended', () => {
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: -10, dueDate })).toMatch(
      /^Ended 2 Apr( 2026)?$/,
    );
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: 0, dueDate })).toBe('Ends today');
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: 1, dueDate })).toBe('1 day left');
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: 153, dueDate })).toBe(
      '153 days left',
    );
  });

  it('describes loan EMIs like dated reminders', () => {
    expect(formatRelativeDue({ kind: 'loan_emi', daysUntilDue: 0, dueDate })).toBe('Today');
    expect(formatRelativeDue({ kind: 'loan_emi', daysUntilDue: 1, dueDate })).toBe('Tomorrow');
    expect(formatRelativeDue({ kind: 'loan_emi', daysUntilDue: 5, dueDate })).toBe('In 5 days');
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
      formatRelativeDue({
        kind: 'reminder',
        daysUntilDue: null,
        dueDate: null,
        dueOdometer: 45000,
      }),
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
    ).toBe('In 3 days');
  });

  it('counts the days itself when the API did not', () => {
    const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString();

    expect(formatRelativeDue({ kind: 'reminder', daysUntilDue: null, dueDate: inAWeek })).toBe(
      'In 7 days',
    );
    expect(formatRelativeDue({ kind: 'document', daysUntilDue: null, dueDate: inAWeek })).toBe(
      '7 days left',
    );
  });
});

describe('formatOdometerDue', () => {
  it('formats kilometres with Indian grouping', () => {
    expect(formatOdometerDue(123456)).toBe('Due at 1,23,456 km');
    expect(formatOdometerDue(60000, 0)).toBe('Due at 60,000 km · 0 km to go');
  });
});

describe('formatRelativeAgo', () => {
  const today = new Date('2026-04-02T00:00:00.000Z');

  function daysAgoIso(days: number): string {
    return new Date(today.getTime() - days * 86_400_000).toISOString();
  }

  it('names today and yesterday', () => {
    expect(formatRelativeAgo(daysAgoIso(0), today)).toBe('today');
    expect(formatRelativeAgo(daysAgoIso(1), today)).toBe('yesterday');
  });

  it('counts single days up to a week', () => {
    expect(formatRelativeAgo(daysAgoIso(3), today)).toBe('3 days ago');
    expect(formatRelativeAgo(daysAgoIso(6), today)).toBe('6 days ago');
  });

  it('switches to whole weeks from 7 days', () => {
    expect(formatRelativeAgo(daysAgoIso(7), today)).toBe('1 week ago');
    expect(formatRelativeAgo(daysAgoIso(13), today)).toBe('1 week ago');
    expect(formatRelativeAgo(daysAgoIso(14), today)).toBe('2 weeks ago');
    expect(formatRelativeAgo(daysAgoIso(29), today)).toBe('4 weeks ago');
  });

  it('switches to whole months from 30 days', () => {
    expect(formatRelativeAgo(daysAgoIso(30), today)).toBe('1 month ago');
    expect(formatRelativeAgo(daysAgoIso(60), today)).toBe('2 months ago');
    expect(formatRelativeAgo(daysAgoIso(364), today)).toBe('12 months ago');
  });

  it('switches to whole years from 365 days', () => {
    expect(formatRelativeAgo(daysAgoIso(365), today)).toBe('1 year ago');
    expect(formatRelativeAgo(daysAgoIso(800), today)).toBe('2 years ago');
  });

  it('treats a future timestamp as today rather than going negative', () => {
    const tomorrow = new Date(today.getTime() + 86_400_000).toISOString();
    expect(formatRelativeAgo(tomorrow, today)).toBe('today');
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
