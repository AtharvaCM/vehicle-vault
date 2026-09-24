import { describe, expect, it } from 'vitest';

import { normalizeUpcomingSearch } from './upcoming-search';

const VEHICLE_ID = '6f1d2c3b-4a59-4e6f-8a7b-9c0d1e2f3a4b';

describe('normalizeUpcomingSearch', () => {
  it('keeps a vehicle id and a known kind', () => {
    expect(normalizeUpcomingSearch({ vehicle: VEHICLE_ID, kind: 'papers' })).toEqual({
      vehicle: VEHICLE_ID,
      kind: 'papers',
    });
  });

  it('drops what it does not know, including the old reminders list filters', () => {
    expect(
      normalizeUpcomingSearch({
        vehicle: 'not-a-uuid',
        kind: 'everything',
        search: 'oil',
        status: 'overdue',
        sort: 'urgency',
      }),
    ).toEqual({});
  });
});
