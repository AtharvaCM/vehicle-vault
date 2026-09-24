import type { VehicleDocument } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { papersAttention } from './papers-attention';

const today = new Date('2026-09-24T06:00:00.000Z');

type PaperOverrides = Partial<Omit<VehicleDocument, 'startDate' | 'endDate'>> & {
  startDate?: string | null;
  endDate?: string | null;
};

function paper({ startDate, endDate, ...overrides }: PaperOverrides): VehicleDocument {
  const toDate = (value: string | null | undefined, fallback: string) =>
    value === null ? null : new Date(value ?? fallback);

  return {
    id: overrides.id ?? `${overrides.kind}-1`,
    vehicleId: 'vehicle-1',
    kind: 'insurance',
    provider: 'Insurer',
    createdAt: new Date('2025-09-01T00:00:00.000Z'),
    updatedAt: new Date('2025-09-01T00:00:00.000Z'),
    ...overrides,
    startDate: toDate(startDate, '2025-09-01T00:00:00.000Z'),
    endDate: toDate(endDate, '2027-09-01T00:00:00.000Z'),
  } as VehicleDocument;
}

describe('papersAttention', () => {
  it('is quiet when every paper is valid for more than 30 days', () => {
    expect(papersAttention([paper({ kind: 'insurance' }), paper({ kind: 'puc' })], today)).toEqual({
      expired: [],
      expiring: [],
      label: null,
      tone: null,
    });
  });

  it('is quiet with no papers at all', () => {
    expect(papersAttention([], today).tone).toBeNull();
  });

  it('flags an expired paper as late', () => {
    const result = papersAttention(
      [paper({ kind: 'insurance', endDate: '2026-09-20T00:00:00.000Z' })],
      today,
    );

    expect(result.expired).toEqual(['insurance']);
    expect(result.tone).toBe('late');
    expect(result.label).toBe('1 paper expired');
  });

  it('flags a paper running out within 30 days as soon', () => {
    const result = papersAttention(
      [
        paper({ kind: 'puc', endDate: '2026-10-10T00:00:00.000Z' }),
        paper({ kind: 'road_tax', endDate: '2026-10-20T00:00:00.000Z' }),
      ],
      today,
    );

    expect(result.expiring).toEqual(['puc', 'road_tax']);
    expect(result.tone).toBe('soon');
    expect(result.label).toBe('2 papers run out soon');
  });

  it('names both when one has expired and another runs out soon', () => {
    const result = papersAttention(
      [
        paper({ kind: 'insurance', endDate: '2026-09-01T00:00:00.000Z' }),
        paper({ kind: 'warranty', endDate: '2026-10-01T00:00:00.000Z' }),
      ],
      today,
    );

    expect(result.tone).toBe('late');
    expect(result.label).toBe('1 paper expired, 1 paper runs out soon');
  });

  it('does not count a warranty that has ended', () => {
    const result = papersAttention(
      [paper({ kind: 'warranty', endDate: '2026-05-26T00:00:00.000Z' })],
      today,
    );

    expect(result.tone).toBeNull();
  });

  it('reads only the current paper of each kind, so a renewed policy is quiet', () => {
    const result = papersAttention(
      [
        paper({
          id: 'old',
          kind: 'insurance',
          startDate: '2025-09-01T00:00:00.000Z',
          endDate: '2026-09-01T00:00:00.000Z',
        }),
        paper({
          id: 'new',
          kind: 'insurance',
          startDate: '2026-09-01T00:00:00.000Z',
          endDate: '2027-09-01T00:00:00.000Z',
        }),
      ],
      today,
    );

    expect(result.tone).toBeNull();
  });

  it('ignores a paper with no end date', () => {
    expect(
      papersAttention([paper({ kind: 'registration', endDate: null })], today).tone,
    ).toBeNull();
  });
});
