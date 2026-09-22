import type { VehicleDocument } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { documentOfRecord } from './document-of-record';

function doc(id: string, startDate: string | null, endDate: string | null): VehicleDocument {
  return {
    id,
    vehicleId: 'vehicle-1',
    kind: 'insurance',
    provider: 'Acme',
    number: null,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    notes: null,
    details: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

describe('documentOfRecord', () => {
  it('is the renewal once there is one, not the policy it renews', () => {
    const old = doc('old', '2025-06-02', '2026-06-01');
    const renewal = doc('renewal', '2026-06-02', '2027-06-01');

    expect(documentOfRecord([old, renewal])?.id).toBe('renewal');
    expect(documentOfRecord([renewal, old])?.id).toBe('renewal');
  });

  it('ranks a record with no start date below a dated one', () => {
    expect(
      documentOfRecord([
        doc('undated', null, '2027-01-01'),
        doc('dated', '2025-01-01', '2026-01-01'),
      ])?.id,
    ).toBe('dated');
  });

  it('prefers an open-ended document on a tie', () => {
    expect(
      documentOfRecord([doc('dated', '2026-01-01', '2027-01-01'), doc('open', '2026-01-01', null)])
        ?.id,
    ).toBe('open');
  });

  it('has nothing to offer for no documents', () => {
    expect(documentOfRecord([])).toBeUndefined();
  });
});
