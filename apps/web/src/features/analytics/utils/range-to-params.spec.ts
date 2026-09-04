import { describe, expect, it } from 'vitest';

import { rangeToParams } from './range-to-params';

const now = new Date('2026-04-02T15:42:11.000Z');

describe('rangeToParams', () => {
  it('returns no bounds for "all"', () => {
    expect(rangeToParams('all', now)).toEqual({});
  });

  it('normalises from to start-of-day and to to end-of-day UTC', () => {
    expect(rangeToParams('30d', now)).toEqual({
      from: '2026-03-03T00:00:00.000Z',
      to: '2026-04-02T23:59:59.999Z',
    });
    expect(rangeToParams('90d', now)).toEqual({
      from: '2026-01-02T00:00:00.000Z',
      to: '2026-04-02T23:59:59.999Z',
    });
    expect(rangeToParams('6m', now)).toEqual({
      from: '2025-10-02T00:00:00.000Z',
      to: '2026-04-02T23:59:59.999Z',
    });
    expect(rangeToParams('1y', now)).toEqual({
      from: '2025-04-02T00:00:00.000Z',
      to: '2026-04-02T23:59:59.999Z',
    });
    expect(rangeToParams('2y', now)).toEqual({
      from: '2024-04-02T00:00:00.000Z',
      to: '2026-04-02T23:59:59.999Z',
    });
  });

  it('never crosses into the next month on the last day of a month', () => {
    const monthEnd = new Date('2026-09-30T04:30:00.000Z');

    expect(rangeToParams('6m', monthEnd).to).toBe('2026-09-30T23:59:59.999Z');
  });

  it('is stable across renders within the same day', () => {
    const later = new Date('2026-04-02T23:59:59.000Z');

    expect(rangeToParams('1y', now)).toEqual(rangeToParams('1y', later));
  });
});
