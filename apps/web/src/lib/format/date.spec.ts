import { describe, expect, it } from 'vitest';

import { date, daysUntil, toValidDate } from './date';

/*
 * Instants are written in UTC so these hold on a UTC CI runner and an IST
 * laptop alike; the module reads every one of them on the Indian calendar.
 */

describe('date', () => {
  it('writes the one date style, with a three-letter month (never "Sept")', () => {
    expect(date('2026-09-23T00:00:00.000Z')).toBe('23 Sep 2026');
    expect(date('2026-05-02T00:00:00.000Z')).toBe('2 May 2026');
  });

  it('writes the short style with the weekday and without the year', () => {
    expect(date('2026-09-23T00:00:00.000Z', 'short')).toBe('Wed 23 Sep');
  });

  it('writes the other styles', () => {
    const value = '2026-09-23T10:35:00.000Z';

    expect(date(value, 'dayMonth')).toBe('23 Sep');
    expect(date(value, 'monthYear')).toBe('Sep 2026');
    expect(date(value, 'monthYearLong')).toBe('September 2026');
    expect(date(value, 'long')).toBe('Wednesday, 23 September 2026');
    expect(date(value, 'dateTime')).toBe('23 Sep 2026, 4:05 pm');
  });

  it('keeps a date-only value on its own day', () => {
    expect(date('2026-09-23')).toBe('23 Sep 2026');
  });

  it('turns the day over at midnight in India, not in UTC', () => {
    expect(date('2026-09-22T18:29:59.000Z')).toBe('22 Sep 2026');
    expect(date('2026-09-22T18:30:00.000Z')).toBe('23 Sep 2026');
    expect(date('2026-12-31T18:30:00.000Z')).toBe('1 Jan 2027');
  });

  it('writes midnight and noon on a 12-hour clock', () => {
    expect(date('2026-09-22T18:30:00.000Z', 'dateTime')).toBe('23 Sep 2026, 12:00 am');
    expect(date('2026-09-23T06:30:00.000Z', 'dateTime')).toBe('23 Sep 2026, 12:00 pm');
  });

  it('accepts a Date and epoch milliseconds', () => {
    const instant = new Date('2026-09-23T00:00:00.000Z');

    expect(date(instant)).toBe('23 Sep 2026');
    expect(date(instant.getTime())).toBe('23 Sep 2026');
  });

  it('shows the empty state, never "Invalid date"', () => {
    for (const bad of ['not a date', '', null, undefined, Number.NaN, new Date('nope')]) {
      expect(date(bad)).toBe('—');
      expect(date(bad, 'dateTime')).toBe('—');
    }
  });
});

describe('daysUntil', () => {
  const dueDay = '2026-09-23T00:00:00.000Z';

  it('is zero on the day itself, all day long in India', () => {
    expect(daysUntil(dueDay, new Date('2026-09-22T18:30:00.000Z'))).toBe(0);
    expect(daysUntil(dueDay, new Date('2026-09-23T18:29:59.000Z'))).toBe(0);
  });

  it('counts the last minutes before Indian midnight as the day before', () => {
    expect(daysUntil(dueDay, new Date('2026-09-22T18:29:59.000Z'))).toBe(1);
  });

  it('goes negative once the day has passed', () => {
    expect(daysUntil(dueDay, new Date('2026-09-23T18:30:00.000Z'))).toBe(-1);
  });

  it('is null for something that is not a date', () => {
    expect(daysUntil('soon', new Date())).toBeNull();
  });
});

describe('toValidDate', () => {
  it('rejects an empty string rather than reading it as the epoch', () => {
    expect(toValidDate('')).toBeNull();
  });
});
