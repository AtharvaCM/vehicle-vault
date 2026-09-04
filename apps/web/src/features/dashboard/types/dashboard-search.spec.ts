import { describe, expect, it } from 'vitest';

import { isDashboardFocus, normalizeDashboardSearch } from './dashboard-search';

describe('normalizeDashboardSearch', () => {
  it('keeps a known focus', () => {
    expect(normalizeDashboardSearch({ focus: 'overdue' })).toEqual({ focus: 'overdue' });
    expect(normalizeDashboardSearch({ focus: 'week' })).toEqual({ focus: 'week' });
    expect(normalizeDashboardSearch({ focus: 'documents' })).toEqual({ focus: 'documents' });
  });

  it('drops unknown or malformed values without throwing', () => {
    expect(normalizeDashboardSearch({ focus: 'later' })).toEqual({});
    expect(normalizeDashboardSearch({ focus: 42 })).toEqual({});
    expect(normalizeDashboardSearch({ focus: undefined })).toEqual({});
    expect(normalizeDashboardSearch({ other: 'x' })).toEqual({});
    expect(normalizeDashboardSearch({})).toEqual({});
    expect(normalizeDashboardSearch(null as unknown as Record<string, unknown>)).toEqual({});
    expect(normalizeDashboardSearch('focus=overdue' as unknown as Record<string, unknown>)).toEqual(
      {},
    );
  });
});

describe('isDashboardFocus', () => {
  it('accepts only the known focus values', () => {
    expect(isDashboardFocus('overdue')).toBe(true);
    expect(isDashboardFocus('week')).toBe(true);
    expect(isDashboardFocus('documents')).toBe(true);
    expect(isDashboardFocus('bogus')).toBe(false);
    expect(isDashboardFocus(undefined)).toBe(false);
    expect(isDashboardFocus(1)).toBe(false);
  });
});
