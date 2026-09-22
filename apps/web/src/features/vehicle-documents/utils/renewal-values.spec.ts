import type { VehicleDocument } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { isRenewable, renewalValues } from './renewal-values';

function makeDocument(overrides: Partial<VehicleDocument> = {}): VehicleDocument {
  return {
    id: 'pol-1',
    vehicleId: 'vehicle-1',
    kind: 'insurance',
    provider: 'HDFC ERGO',
    number: 'POL-2025-17',
    startDate: new Date('2025-06-02T00:00:00.000Z'),
    endDate: new Date('2026-06-01T00:00:00.000Z'),
    notes: 'Zero depreciation add-on',
    details: { premiumAmount: 14_500, insuredValue: 950_000 },
    createdAt: new Date('2025-06-02T00:00:00.000Z'),
    updatedAt: new Date('2025-06-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('renewalValues', () => {
  it('carries the policy over, starting the day after the old one ends, for the same term', () => {
    expect(renewalValues(makeDocument())).toEqual({
      provider: 'HDFC ERGO',
      policyNumber: 'POL-2025-17',
      premiumAmount: 14_500,
      insuredValue: 950_000,
      startDate: '2026-06-02',
      endDate: '2027-06-01',
    });
  });

  it('assumes a year for a record that only ever knew its expiry', () => {
    const values = renewalValues(
      makeDocument({ provider: null, number: null, startDate: null, details: {} }),
    );

    expect(values).toMatchObject({ startDate: '2026-06-02', endDate: '2027-06-01' });
    expect(values.provider).toBeUndefined();
  });

  it('keeps a PUC certificate to its own shorter term', () => {
    const values = renewalValues(
      makeDocument({
        kind: 'puc',
        provider: 'PUC Centre Baner',
        number: 'PUC-4411',
        startDate: new Date('2025-12-01T00:00:00.000Z'),
        endDate: new Date('2026-05-31T00:00:00.000Z'),
        details: { amount: 150 },
      }),
    );

    expect(values).toEqual({
      provider: 'PUC Centre Baner',
      number: 'PUC-4411',
      amount: 150,
      startDate: '2026-06-01',
      endDate: '2026-11-30',
    });
  });

  it('keeps a day count for a term that was not whole months', () => {
    const values = renewalValues(
      makeDocument({
        startDate: new Date('2026-01-10T00:00:00.000Z'),
        endDate: new Date('2026-03-01T00:00:00.000Z'),
      }),
    );

    // 50 days after the start, as before.
    expect(values).toMatchObject({ startDate: '2026-03-02', endDate: '2026-04-21' });
  });

  it("copies a warranty's type and number, not the old term's notes", () => {
    const values = renewalValues(
      makeDocument({ kind: 'warranty', details: { type: 'Extended', endOdometer: 100_000 } }),
    );

    expect(values).toMatchObject({ warrantyNumber: 'POL-2025-17', type: 'Extended' });
    expect(values).not.toHaveProperty('notes');
  });
});

describe('isRenewable', () => {
  const today = new Date('2026-05-20T00:00:00.000Z');

  it('offers renewal within a month of the expiry, and after it', () => {
    expect(isRenewable(makeDocument(), today)).toBe(true);
    expect(isRenewable(makeDocument({ endDate: new Date('2026-04-01') }), today)).toBe(true);
  });

  it('holds off while the expiry is still further out', () => {
    expect(isRenewable(makeDocument({ endDate: new Date('2026-09-01') }), today)).toBe(false);
  });

  it('never offers it for a document that does not expire', () => {
    expect(isRenewable(makeDocument({ kind: 'road_tax', endDate: null }), today)).toBe(false);
  });
});
