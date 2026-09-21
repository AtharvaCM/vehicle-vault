import { describe, expect, it } from 'vitest';

import { describeVehicleModel } from './describe-vehicle-model';

describe('describeVehicleModel', () => {
  it('reads make, model and variant when all three are known', () => {
    expect(describeVehicleModel({ make: 'Bajaj', model: 'Pulsar NS 200', variant: 'ABS' })).toBe(
      'Bajaj Pulsar NS 200 ABS',
    );
  });

  it('drops the variant rather than leaving a dangling separator', () => {
    for (const variant of [undefined, '', '   ']) {
      expect(describeVehicleModel({ make: 'Bajaj', model: 'Pulsar NS 200', variant })).toBe(
        'Bajaj Pulsar NS 200',
      );
    }
  });
});
