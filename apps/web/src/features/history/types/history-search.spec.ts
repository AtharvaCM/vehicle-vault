import { describe, expect, it } from 'vitest';

import { normalizeHistorySearch } from './history-search';

const VEHICLE_ID = '11111111-1111-1111-1111-111111111111';

describe('normalizeHistorySearch', () => {
  it('keeps a valid uuid vehicle and a valid kind', () => {
    expect(normalizeHistorySearch({ vehicle: VEHICLE_ID, kind: 'fuel' })).toEqual({
      vehicle: VEHICLE_ID,
      kind: 'fuel',
    });
  });

  it('drops a vehicle that is not a uuid', () => {
    expect(normalizeHistorySearch({ vehicle: 'not-a-uuid', kind: 'fuel' })).toEqual({
      kind: 'fuel',
    });
  });

  it('drops a kind outside service, fuel and odometer', () => {
    expect(normalizeHistorySearch({ vehicle: VEHICLE_ID, kind: 'insurance' })).toEqual({
      vehicle: VEHICLE_ID,
    });
  });

  it("keeps the old maintenance list's search, and drops its category and sort", () => {
    expect(
      normalizeHistorySearch({
        vehicle: VEHICLE_ID,
        kind: 'service',
        search: 'torque',
        category: 'engine_oil',
        sort: 'date_desc',
      }),
    ).toEqual({ vehicle: VEHICLE_ID, kind: 'service', search: 'torque' });
  });

  it('trims a search, caps it at 100 characters, and drops a blank one', () => {
    expect(normalizeHistorySearch({ search: '  Torque Garage ' })).toEqual({
      search: 'Torque Garage',
    });
    expect(normalizeHistorySearch({ search: 'x'.repeat(120) }).search).toHaveLength(100);
    expect(normalizeHistorySearch({ search: '   ' })).toEqual({});
    expect(normalizeHistorySearch({ search: 7 })).toEqual({});
  });

  it('returns an empty object when nothing valid is set', () => {
    expect(normalizeHistorySearch({})).toEqual({});
    expect(normalizeHistorySearch({ vehicle: 42, kind: null })).toEqual({});
  });
});
