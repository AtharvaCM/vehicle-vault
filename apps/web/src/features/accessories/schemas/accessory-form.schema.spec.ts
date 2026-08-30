import { describe, expect, it } from 'vitest';

import {
  accessoryFormSchema,
  toDateInputValue,
  toIsoDate,
} from './accessory-form.schema';

const base = {
  name: 'Dashcam',
  brand: '',
  category: '',
  purchaseDate: '2026-07-04',
  cost: 7499,
  fittedDate: '',
  removedDate: '',
  warrantyExpiresAt: '',
  notes: '',
};

describe('accessoryFormSchema', () => {
  it('accepts an accessory that was bought but never fitted', () => {
    expect(accessoryFormSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a removal with no fitment behind it', () => {
    const result = accessoryFormSchema.safeParse({ ...base, removedDate: '2026-08-01' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['removedDate']);
  });

  it('rejects a removal dated before the fitment', () => {
    const result = accessoryFormSchema.safeParse({
      ...base,
      fittedDate: '2026-08-01',
      removedDate: '2026-07-10',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/earlier than fitment/);
  });

  it('rejects a removal odometer below the fitted one', () => {
    const result = accessoryFormSchema.safeParse({
      ...base,
      fittedDate: '2026-07-06',
      fittedOdometer: 5120,
      removedDate: '2026-08-01',
      removedOdometer: 4000,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['removedOdometer']);
  });

  it('accepts the empty strings react-hook-form actually produces for blank optionals', () => {
    // register() never yields undefined, so every optional rule has to survive ''.
    expect(
      accessoryFormSchema.safeParse({ ...base, brand: '', fittedDate: '', notes: '' }).success,
    ).toBe(true);
  });
});

describe('date helpers', () => {
  it('turns a date input value into an ISO instant', () => {
    expect(toIsoDate('2026-07-04')).toBe('2026-07-04T00:00:00.000Z');
  });

  it('treats a blank date as absent rather than epoch', () => {
    expect(toIsoDate('')).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
  });

  it('round-trips an ISO instant back to a date input value', () => {
    expect(toDateInputValue('2026-07-04T00:00:00.000Z')).toBe('2026-07-04');
    expect(toDateInputValue(null)).toBe('');
  });
});
