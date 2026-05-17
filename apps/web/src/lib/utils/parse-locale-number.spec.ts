import { describe, expect, it } from 'vitest';

import { parseLocaleNumber } from './parse-locale-number';

describe('parseLocaleNumber', () => {
  it('parses plain and grouped numbers', () => {
    expect(parseLocaleNumber('3450')).toBe(3450);
    expect(parseLocaleNumber('3,450')).toBe(3450);
    expect(parseLocaleNumber('1,23,456.78')).toBe(123456.78);
  });

  it('parses common Indian currency formats', () => {
    expect(parseLocaleNumber('₹3,450')).toBe(3450);
    expect(parseLocaleNumber('Rs. 3,450')).toBe(3450);
    expect(parseLocaleNumber('INR 2,500.50')).toBe(2500.5);
  });

  it('returns NaN for empty or non-numeric input', () => {
    expect(parseLocaleNumber('')).toBeNaN();
    expect(parseLocaleNumber('N/A')).toBeNaN();
  });
});
