import { describe, expect, it } from 'vitest';

import { keepsCatalogSelection } from './keeps-catalog-selection';

describe('keepsCatalogSelection', () => {
  const soldFrom2019To2023 = { yearStart: 2019, yearEnd: 2023 };

  it('keeps the selection for a year the variant was sold in', () => {
    expect(keepsCatalogSelection(2019, soldFrom2019To2023)).toBe(true);
    expect(keepsCatalogSelection(2023, soldFrom2019To2023)).toBe(true);
  });

  it('starts the pickers over for a year it was not', () => {
    expect(keepsCatalogSelection(2018, soldFrom2019To2023)).toBe(false);
    expect(keepsCatalogSelection(2024, soldFrom2019To2023)).toBe(false);
  });

  it('treats a missing end as still on sale', () => {
    expect(keepsCatalogSelection(2026, { yearStart: 2019, yearEnd: undefined })).toBe(true);
  });

  it('starts over when no variant is chosen, as the form always has', () => {
    expect(keepsCatalogSelection(2024, null)).toBe(false);
  });

  it('waits while the year is still being typed', () => {
    for (const partial of [Number.NaN, 0, 2, 20, 202]) {
      expect(keepsCatalogSelection(partial, null)).toBe(true);
    }
  });
});
