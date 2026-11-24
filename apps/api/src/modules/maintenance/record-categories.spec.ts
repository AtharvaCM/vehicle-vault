import { describe, expect, it } from 'vitest';

import { categoriesCovered, coveringAnyOf, coversCategory } from './record-categories';

describe('categoriesCovered', () => {
  it('is the record category plus each line item category', () => {
    const record = {
      category: 'periodic_service',
      lineItems: [
        { normalizedCategory: 'oil_filter' },
        { normalizedCategory: 'engine_oil' },
        { normalizedCategory: null },
      ],
    };

    expect([...categoriesCovered(record)].sort()).toEqual([
      'engine_oil',
      'oil_filter',
      'periodic_service',
    ]);
    expect(coversCategory(record, 'oil_filter')).toBe(true);
    expect(coversCategory(record, 'air_filter')).toBe(false);
  });

  it('ignores line items tagged other and records without line items', () => {
    expect([
      ...categoriesCovered({
        category: 'brake_pads',
        lineItems: [{ normalizedCategory: 'other' }],
      }),
    ]).toEqual(['brake_pads']);
    expect([...categoriesCovered({ category: 'coolant' })]).toEqual(['coolant']);
  });
});

describe('coveringAnyOf', () => {
  it('matches on the record category or any line item category', () => {
    expect(coveringAnyOf(['oil_filter'])).toEqual({
      OR: [
        { category: { in: ['oil_filter'] } },
        { lineItems: { some: { normalizedCategory: { in: ['oil_filter'] } } } },
      ],
    });
  });
});
