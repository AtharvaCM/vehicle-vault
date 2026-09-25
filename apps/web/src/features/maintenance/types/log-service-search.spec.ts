import { describe, expect, it } from 'vitest';

import { normalizeLogServiceSearch } from './log-service-search';

describe('normalizeLogServiceSearch', () => {
  it('keeps a known category and a reminder id', () => {
    expect(
      normalizeLogServiceSearch({
        category: 'engine_oil',
        reminderId: '3f6b1a52-8f4e-4c1f-9d55-3f2c7b9e1a20',
      }),
    ).toEqual({ category: 'engine_oil', reminderId: '3f6b1a52-8f4e-4c1f-9d55-3f2c7b9e1a20' });
  });

  it('drops an unknown category, a malformed id and anything else', () => {
    expect(
      normalizeLogServiceSearch({ category: 'rocket_fuel', reminderId: 'nope', tab: 'x' }),
    ).toEqual({});
  });
});
