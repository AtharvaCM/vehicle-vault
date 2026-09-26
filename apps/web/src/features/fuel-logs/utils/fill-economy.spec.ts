import type { FuelLog } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { fillEconomy } from './fill-economy';

function fill(id: string, odometer: number, quantity: number, day = 1): FuelLog {
  const date = `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`;
  return {
    id,
    vehicleId: 'vehicle-1',
    date,
    odometer,
    quantity,
    price: 105,
    totalCost: quantity * 105,
    createdAt: date,
    updatedAt: date,
  };
}

describe('fillEconomy', () => {
  it('measures each fill against the one before it, newest first or not', () => {
    const economy = fillEconomy([
      fill('c', 15_410, 25, 3),
      fill('a', 14_950, 30, 1),
      fill('b', 15_180, 42.5, 2),
    ]);

    expect(economy.get('a')).toBeUndefined();
    expect(economy.get('b')).toBe(5.4);
    expect(economy.get('c')).toBe(9.2);
  });

  it('skips a fill with no reading, or one that repeats a reading', () => {
    const economy = fillEconomy([
      fill('a', 10_000, 20, 1),
      fill('none', 0, 20, 2),
      fill('dup', 10_000, 20, 3),
      fill('b', 10_300, 20, 4),
    ]);

    expect(economy.has('none')).toBe(false);
    expect(economy.has('dup')).toBe(false);
    expect(economy.get('b')).toBe(15);
  });
});
