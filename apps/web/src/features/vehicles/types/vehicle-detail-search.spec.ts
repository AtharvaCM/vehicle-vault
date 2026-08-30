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

  it('keeps the accessories tab so a deep link survives a reload', () => {
    // validateSearch silently drops an unregistered tab, which makes a working
    // TabsTrigger bounce the user to Overview on refresh.
    expect(normalizeVehicleDetailSearch({ tab: 'accessories' })).toEqual({
      tab: 'accessories',
    });
  });

  it('drops unsupported tabs', () => {
    expect(normalizeVehicleDetailSearch({ tab: 'unknown' })).toEqual({});
  });
});
