import { describe, expect, it } from 'vitest';

import { formatMaintenanceCategory } from './format-maintenance-category';

describe('formatMaintenanceCategory', () => {
  it.each([
    ['engine_oil', 'Engine Oil'],
    ['spark_plug', 'Spark Plug'],
    ['cvt_belt', 'CVT Belt'],
    ['puc', 'PUC'],
  ])('formats %s as %s', (category, label) => {
    expect(formatMaintenanceCategory(category)).toBe(label);
  });
});
