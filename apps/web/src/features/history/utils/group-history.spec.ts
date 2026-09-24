import { describe, expect, it } from 'vitest';
import type { HistoryOdometerEntry, HistoryPage } from '@vehicle-vault/shared';

import { groupHistory, monthStart } from './group-history';

function odometerEntry(
  id: string,
  month: string,
  occurredAt: string,
  overrides: Partial<HistoryOdometerEntry> = {},
): HistoryOdometerEntry {
  return {
    id,
    vehicleId: 'vehicle-1',
    occurredAt,
    month,
    kind: 'odometer',
    odometer: 10_000,
    previousOdometer: null,
    ...overrides,
  };
}

describe('groupHistory', () => {
  it('groups newest-first entries by month, in the order they arrive', () => {
    const page: HistoryPage = {
      entries: [
        odometerEntry('e1', '2026-09', '2026-09-20T00:00:00.000Z'),
        odometerEntry('e2', '2026-09', '2026-09-10T00:00:00.000Z'),
        odometerEntry('e3', '2026-08', '2026-08-15T00:00:00.000Z'),
      ],
      months: [
        { month: '2026-09', total: '500.00', draftCount: 0 },
        { month: '2026-08', total: null, draftCount: 0 },
      ],
      draftCount: 0,
      nextCursor: null,
    };

    const groups = groupHistory([page]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ month: '2026-09', total: 500, draftCount: 0 });
    expect(groups[0]!.entries.map((entry) => entry.id)).toEqual(['e1', 'e2']);
    expect(groups[1]).toMatchObject({ month: '2026-08', total: null, draftCount: 0 });
    expect(groups[1]!.entries.map((entry) => entry.id)).toEqual(['e3']);
  });

  it('merges a month split across two pages into one group with the API total', () => {
    const page1: HistoryPage = {
      entries: [odometerEntry('e1', '2026-09', '2026-09-20T00:00:00.000Z')],
      months: [{ month: '2026-09', total: '100.00', draftCount: 1 }],
      draftCount: 1,
      nextCursor: 'cursor-1',
    };
    const page2: HistoryPage = {
      entries: [
        odometerEntry('e2', '2026-09', '2026-09-05T00:00:00.000Z'),
        odometerEntry('e3', '2026-08', '2026-08-15T00:00:00.000Z'),
      ],
      months: [
        { month: '2026-09', total: '100.00', draftCount: 1 },
        { month: '2026-08', total: null, draftCount: 0 },
      ],
      draftCount: 0,
      nextCursor: null,
    };

    const groups = groupHistory([page1, page2]);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.month).toBe('2026-09');
    expect(groups[0]!.total).toBe(100);
    expect(groups[0]!.draftCount).toBe(1);
    expect(groups[0]!.entries.map((entry) => entry.id)).toEqual(['e1', 'e2']);
    expect(groups[1]!.month).toBe('2026-08');
  });

  it('keeps a null total null rather than coercing it to 0', () => {
    const page: HistoryPage = {
      entries: [odometerEntry('e1', '2026-08', '2026-08-15T00:00:00.000Z')],
      months: [{ month: '2026-08', total: null, draftCount: 0 }],
      draftCount: 0,
      nextCursor: null,
    };

    expect(groupHistory([page])[0]!.total).toBeNull();
  });

  it('carries the draft count from the month summary onto the group', () => {
    const page: HistoryPage = {
      entries: [odometerEntry('e1', '2026-09', '2026-09-20T00:00:00.000Z')],
      months: [{ month: '2026-09', total: null, draftCount: 3 }],
      draftCount: 3,
      nextCursor: null,
    };

    expect(groupHistory([page])[0]!.draftCount).toBe(3);
  });

  it('returns no groups for no pages', () => {
    expect(groupHistory([])).toEqual([]);
  });
});

describe('monthStart', () => {
  it('names the first instant of the month, in UTC', () => {
    expect(monthStart('2026-09')).toBe('2026-09-01T00:00:00.000Z');
  });
});
