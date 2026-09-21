import { describe, expect, it } from 'vitest';

import { vehicleModelLabel, vehicleModelLine } from './vehicle-model-line';

describe('vehicle model line in reports', () => {
  const creta = { make: 'Hyundai', model: 'Creta' };

  it('prints the trim when the vehicle has one', () => {
    expect(vehicleModelLine({ ...creta, variant: 'SX' })).toBe('Hyundai Creta SX');
    expect(vehicleModelLabel({ variant: 'SX' })).toBe('Make / Model / Variant');
  });

  it('leaves no trailing gap when it does not', () => {
    for (const variant of [undefined, null, '']) {
      expect(vehicleModelLine({ ...creta, variant })).toBe('Hyundai Creta');
      expect(vehicleModelLabel({ variant })).toBe('Make / Model');
    }
  });
});
