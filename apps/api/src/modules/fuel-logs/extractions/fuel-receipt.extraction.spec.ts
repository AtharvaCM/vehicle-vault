import { describe, expect, it } from 'vitest';

import { FuelReceiptExtractionSpec } from './fuel-receipt.extraction';

describe('FuelReceiptExtractionSpec.normalize', () => {
  const spec = new FuelReceiptExtractionSpec();

  it('passes through valid fields', () => {
    expect(
      spec.normalize({
        date: '2026-01-15',
        quantity: 32.5,
        price: 102.5,
        totalCost: 3331.25,
        location: 'HP Petrol Pump',
      }),
    ).toEqual({
      date: '2026-01-15',
      quantity: 32.5,
      price: 102.5,
      totalCost: 3331.25,
      location: 'HP Petrol Pump',
    });
  });

  it('drops negative numbers, NaN, and blank strings', () => {
    expect(
      spec.normalize({
        date: '   ',
        quantity: -5,
        price: Number.NaN,
        totalCost: 0,
        location: '',
      }),
    ).toEqual({
      date: undefined,
      quantity: undefined,
      price: undefined,
      totalCost: 0,
      location: undefined,
    });
  });

  it('handles null and missing input', () => {
    expect(spec.normalize(null)).toEqual({
      date: undefined,
      quantity: undefined,
      price: undefined,
      totalCost: undefined,
      location: undefined,
    });
  });
});
