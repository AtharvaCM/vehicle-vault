import { describe, expect, it } from 'vitest';

import { compactMoney, distance, money, number, odometer } from './number';

describe('money', () => {
  it('groups rupees the Indian way: thousands, then lakhs, then crores', () => {
    expect(money(999)).toBe('₹999');
    expect(money(1_000)).toBe('₹1,000');
    expect(money(1_31_624)).toBe('₹1,31,624');
    expect(money(12_34_56_789)).toBe('₹12,34,56,789');
  });

  it('prints whole rupees by default and rounds to them', () => {
    expect(money(2_499.6)).toBe('₹2,500');
  });

  it('prints the decimals it is asked for', () => {
    expect(money(8.4, { decimals: 1 })).toBe('₹8.4');
    expect(money(1_250, { decimals: 2 })).toBe('₹1,250.00');
  });

  it('keeps a negative sign, as a refund or discount', () => {
    expect(money(-500)).toBe('-₹500');
  });

  it('formats another currency a record carries, with two decimals', () => {
    expect(money(1_234.5, { currency: 'USD' })).toMatch(/1,234\.50$/);
  });

  it('falls back to rupees when the record has no currency', () => {
    expect(money(100, { currency: null })).toBe('₹100');
  });

  it('shows the empty state for a missing or unreadable amount', () => {
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
    expect(money(Number.NaN)).toBe('—');
    expect(money(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('number', () => {
  it('groups in lakhs and crores', () => {
    expect(number(1_00_000)).toBe('1,00,000');
    expect(number(1_00_00_000)).toBe('1,00,00,000');
  });

  it('keeps up to two decimals by default, so a fuel fill of 42.5 litres is not rounded', () => {
    expect(number(42.5)).toBe('42.5');
    expect(number(30)).toBe('30');
    expect(number(12.345)).toBe('12.35');
  });

  it('trims decimals unless asked to keep them fixed', () => {
    expect(number(12, { decimals: 1 })).toBe('12');
    expect(number(12, { decimals: 1, fixed: true })).toBe('12.0');
    expect(number(12.6, { decimals: 0 })).toBe('13');
  });

  it('shows the empty state for a missing value', () => {
    expect(number(null)).toBe('—');
  });
});

describe('distance and odometer', () => {
  it('adds the unit after an Indian-grouped figure', () => {
    expect(distance(1_24_800)).toBe('1,24,800 km');
    expect(odometer(31_800)).toBe('31,800 km');
  });

  it('keeps an odometer reading whole', () => {
    expect(odometer(31_800.7)).toBe('31,801 km');
  });

  it('allows decimals on a distance when asked', () => {
    expect(distance(4.56, { decimals: 1 })).toBe('4.6 km');
  });

  it('never prints "NaN km"', () => {
    expect(distance(Number.NaN)).toBe('—');
    expect(odometer(undefined)).toBe('—');
  });
});

describe('compactMoney', () => {
  it('shortens rupees the Indian way for chart axes', () => {
    expect(compactMoney(950)).toBe('₹950');
    expect(compactMoney(4_200)).toBe('₹4.2k');
    expect(compactMoney(38_000)).toBe('₹38k');
    expect(compactMoney(1_31_624)).toBe('₹1.3L');
    expect(compactMoney(21_00_000)).toBe('₹21L');
    expect(compactMoney(2_10_00_000)).toBe('₹2.1Cr');
  });

  it('keeps the sign and shows a dash for no amount', () => {
    expect(compactMoney(-4_200)).toBe('-₹4.2k');
    expect(compactMoney(0)).toBe('₹0');
    expect(compactMoney(null)).toBe('—');
  });
});
