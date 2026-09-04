import type { VehicleDocument } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { isMoreRecentDocument, pickLatestDocument } from './document-recency';

function makeDocument(overrides: Partial<VehicleDocument> = {}): VehicleDocument {
  return {
    id: 'doc-1',
    vehicleId: 'vehicle-1',
    kind: 'insurance',
    provider: 'Acme',
    number: 'POL-1',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2027-01-01T00:00:00.000Z'),
    notes: null,
    details: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('isMoreRecentDocument', () => {
  it('prefers the later startDate outright', () => {
    const older = makeDocument({ startDate: new Date('2026-01-01T00:00:00.000Z') });
    const newer = makeDocument({ startDate: new Date('2026-06-01T00:00:00.000Z') });

    expect(isMoreRecentDocument(newer, older)).toBe(true);
    expect(isMoreRecentDocument(older, newer)).toBe(false);
  });

  it('on a startDate tie, ranks an open-ended endDate above a dated one', () => {
    const dated = makeDocument({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-01T00:00:00.000Z'),
    });
    const openEnded = makeDocument({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: null,
    });

    expect(isMoreRecentDocument(openEnded, dated)).toBe(true);
    expect(isMoreRecentDocument(dated, openEnded)).toBe(false);
  });

  it('does not let an older open-ended document mask a newer dated renewal', () => {
    const olderOpenEnded = makeDocument({
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: null,
    });
    const newerDated = makeDocument({
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-01T00:00:00.000Z'),
    });

    expect(isMoreRecentDocument(newerDated, olderOpenEnded)).toBe(true);
  });
});

describe('pickLatestDocument', () => {
  it('returns undefined for an empty list', () => {
    expect(pickLatestDocument([])).toBeUndefined();
  });

  it('picks the single most current document out of several', () => {
    const oldest = makeDocument({ id: 'oldest', startDate: new Date('2025-01-01T00:00:00.000Z') });
    const middle = makeDocument({ id: 'middle', startDate: new Date('2026-01-01T00:00:00.000Z') });
    const latest = makeDocument({ id: 'latest', startDate: new Date('2026-06-01T00:00:00.000Z') });

    expect(pickLatestDocument([oldest, latest, middle])?.id).toBe('latest');
  });
});
