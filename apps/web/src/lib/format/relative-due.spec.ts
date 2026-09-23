import { describe, expect, it } from 'vitest';

import { relativeDue } from './relative-due';

// 10:00 in India on Wed 23 Sep 2026.
const now = new Date('2026-09-23T04:30:00.000Z');
const day = (isoDate: string) => `${isoDate}T00:00:00.000Z`;

describe('relativeDue: something to do', () => {
  it('says how late it is', () => {
    expect(relativeDue(day('2026-09-20'), { now })).toBe('3 days late');
    expect(relativeDue(day('2026-09-22'), { now })).toBe('1 day late');
  });

  it('says today and tomorrow', () => {
    expect(relativeDue(day('2026-09-23'), { now })).toBe('Today');
    expect(relativeDue(day('2026-09-24'), { now })).toBe('Tomorrow');
  });

  it('counts the days to go', () => {
    expect(relativeDue(day('2026-09-27'), { now })).toBe('In 4 days');
  });

  it('counts Indian days: 00:10 IST is already the due day', () => {
    const justAfterMidnight = new Date('2026-09-22T18:40:00.000Z');

    expect(relativeDue(day('2026-09-23'), { now: justAfterMidnight })).toBe('Today');
  });

  it('uses days counted elsewhere when given', () => {
    expect(relativeDue(day('2026-09-23'), { now, days: -2 })).toBe('2 days late');
  });
});

describe('relativeDue: something valid until a date', () => {
  it('counts the days left', () => {
    expect(relativeDue(day('2027-02-23'), { now, mode: 'ends' })).toBe('153 days left');
    expect(relativeDue(day('2026-09-24'), { now, mode: 'ends' })).toBe('1 day left');
  });

  it('says it ends today', () => {
    expect(relativeDue(day('2026-09-23'), { now, mode: 'ends' })).toBe('Ends today');
  });

  it('says when it ended, adding the year only when it is not this year', () => {
    expect(relativeDue(day('2026-09-20'), { now, mode: 'ends' })).toBe('Ended 20 Sep');
    expect(relativeDue(day('2025-12-30'), { now, mode: 'ends' })).toBe('Ended 30 Dec 2025');
  });
});

describe('relativeDue: nothing to go on', () => {
  it('shows the empty state for a missing or unreadable date', () => {
    expect(relativeDue(null, { now })).toBe('—');
    expect(relativeDue('whenever', { now, mode: 'ends' })).toBe('—');
  });

  it('still answers from a day count alone', () => {
    expect(relativeDue(null, { now, days: 4 })).toBe('In 4 days');
    expect(relativeDue(null, { now, days: -5, mode: 'ends' })).toBe('Ended 5 days ago');
  });
});
