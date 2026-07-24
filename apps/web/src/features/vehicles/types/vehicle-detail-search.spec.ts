import { describe, expect, it } from 'vitest';

import { normalizeVehicleDetailSearch } from './vehicle-detail-search';

describe('normalizeVehicleDetailSearch', () => {
  it('keeps supported non-default tabs', () => {
    expect(normalizeVehicleDetailSearch({ tab: 'maintenance' })).toEqual({
      tab: 'maintenance',
    });
  });

  it('omits the default tab from the URL search state', () => {
    expect(normalizeVehicleDetailSearch({ tab: 'overview' })).toEqual({});
  });

  it('drops unsupported tabs', () => {
    expect(normalizeVehicleDetailSearch({ tab: 'unknown' })).toEqual({});
  });
});
