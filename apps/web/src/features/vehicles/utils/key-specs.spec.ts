import { describe, expect, it } from 'vitest';

import type { VehicleVariantSpec } from '../hooks/use-variant-specs';
import { keySpecsLine } from './key-specs';

function specs(overrides: Partial<VehicleVariantSpec>): VehicleVariantSpec {
  return { id: 'spec-1', variantId: 'variant-1', ...overrides } as VehicleVariantSpec;
}

describe('keySpecsLine', () => {
  it('reads tyres, tank, engine and gearbox as one line', () => {
    expect(
      keySpecsLine(
        specs({
          tyreSize: '205/55 R16',
          fuelCapLitres: 45,
          engineCc: 1498,
          engineFuel: 'Petrol',
          transmission: '7-speed DSG',
        }),
      ),
    ).toBe('Tyres 205/55 R16 · Tank 45 L · 1,498 cc petrol · 7-speed DSG');
  });

  it('leaves out what the catalogue does not have', () => {
    expect(keySpecsLine(specs({ tyreSize: ' 100/90 17 ', engineCc: 349 }))).toBe(
      'Tyres 100/90 17 · 349 cc',
    );
  });

  it('is null when none of the key figures are known', () => {
    expect(keySpecsLine(specs({ doors: 4, airbagCount: 6 }))).toBeNull();
  });
});
