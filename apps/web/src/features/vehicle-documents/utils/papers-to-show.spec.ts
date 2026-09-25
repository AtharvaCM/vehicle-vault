import type { VehicleDocument } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { papersToShow } from './papers-to-show';

function document(
  id: string,
  kind: VehicleDocument['kind'],
  startDate: string | null = '2026-01-01',
): VehicleDocument {
  return {
    id,
    vehicleId: 'vehicle-1',
    kind,
    provider: null,
    number: null,
    startDate: startDate ? new Date(startDate) : null,
    endDate: null,
    notes: null,
    details: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

describe('papersToShow', () => {
  it('holds one paper per kind on file, insurance first and warranty last', () => {
    const papers = papersToShow([
      document('w', 'warranty'),
      document('rc', 'registration'),
      document('tax', 'road_tax'),
      document('puc', 'puc'),
      document('ins', 'insurance'),
    ]);

    expect(papers.map((paper) => paper.kind)).toEqual([
      'insurance',
      'puc',
      'road_tax',
      'registration',
      'warranty',
    ]);
  });

  it('leaves out the kinds not on file', () => {
    expect(papersToShow([document('puc', 'puc')]).map((paper) => paper.id)).toEqual(['puc']);
    expect(papersToShow([])).toEqual([]);
  });

  it('shows the current one of a kind: the one the alerts follow', () => {
    const papers = papersToShow([
      document('old', 'insurance', '2025-01-01'),
      document('new', 'insurance', '2026-01-01'),
    ]);

    expect(papers.map((paper) => paper.id)).toEqual(['new']);
  });

  it("shows the document an old link named in its kind's place", () => {
    const papers = papersToShow(
      [document('old', 'insurance', '2025-01-01'), document('new', 'insurance', '2026-01-01')],
      'old',
    );

    expect(papers.map((paper) => paper.id)).toEqual(['old']);
  });

  it('ignores a named document that is not on this vehicle', () => {
    expect(papersToShow([document('puc', 'puc')], 'missing').map((paper) => paper.id)).toEqual([
      'puc',
    ]);
  });
});
