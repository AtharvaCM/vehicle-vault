import { describe, expect, it } from 'vitest';

import { getVehicleDisplayName } from './get-vehicle-display-name';

describe('getVehicleDisplayName', () => {
  it('prefers the nickname when one is set', () => {
    expect(getVehicleDisplayName({ make: 'Honda', model: 'City', nickname: 'Daily driver' })).toBe(
      'Daily driver',
    );
  });

  it('falls back to make and model when there is no nickname', () => {
    for (const nickname of [undefined, '', '   ']) {
      expect(getVehicleDisplayName({ make: 'Honda', model: 'City', nickname })).toBe('Honda City');
    }
  });
});
