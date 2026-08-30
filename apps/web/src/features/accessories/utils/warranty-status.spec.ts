import { describe, expect, it } from 'vitest';

import { daysUntilExpiry } from './warranty-status';

/**
 * `new Date(y, m, d)` is local midnight, and its getters return exactly those
 * parts in every timezone — so these assertions hold on a UTC CI runner and on
 * an IST laptop alike. A test that pinned the clock to an instant instead would
 * pass in one zone and fail in the other, which is the bug being guarded here.
 */
describe('daysUntilExpiry', () => {
  it('is zero on the expiry day itself', () => {
    expect(daysUntilExpiry('2026-07-06T00:00:00.000Z', new Date(2026, 6, 6))).toBe(0);
  });

  it('goes negative the day after expiry', () => {
    expect(daysUntilExpiry('2026-07-05T00:00:00.000Z', new Date(2026, 6, 6))).toBe(-1);
  });

  it('counts forward to a future expiry', () => {
    expect(daysUntilExpiry('2026-07-13T00:00:00.000Z', new Date(2026, 6, 6))).toBe(7);
  });

  it('ignores the time of day on either side', () => {
    // Late-evening local time must not tip the count into the next day.
    expect(daysUntilExpiry('2026-07-06T23:59:00.000Z', new Date(2026, 6, 6, 23, 45))).toBe(0);
  });
});
