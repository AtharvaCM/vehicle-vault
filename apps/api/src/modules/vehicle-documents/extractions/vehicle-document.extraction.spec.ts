import { describe, expect, it } from 'vitest';

import { ComplianceDocumentExtractionSpec } from './compliance-document.extraction';
import { WarrantyDocumentExtractionSpec } from './warranty-document.extraction';

describe('WarrantyDocumentExtractionSpec', () => {
  const spec = new WarrantyDocumentExtractionSpec();

  it('normalizes a typical extended-warranty payload', () => {
    expect(
      spec.normalize({
        provider: '  Hyundai Motor India  ',
        warrantyNumber: 'WTY-99881',
        type: 'extended',
        startDate: '2026-01-15',
        endDate: '2029-01-14',
        endOdometer: 100000.4,
        notes: 'Powertrain only',
      }),
    ).toEqual({
      provider: 'Hyundai Motor India',
      warrantyNumber: 'WTY-99881',
      // Case-insensitively matched back onto the value the form's select accepts.
      type: 'Extended',
      startDate: '2026-01-15T00:00:00.000Z',
      endDate: '2029-01-14T00:00:00.000Z',
      endOdometer: 100000,
      notes: 'Powertrain only',
    });
  });

  it('drops a coverage type the form cannot represent rather than guessing', () => {
    expect(spec.normalize({ type: 'Roadside assistance' }).type).toBeUndefined();
  });

  it('discards unusable dates and negative odometer readings', () => {
    const draft = spec.normalize({ startDate: 'not a date', endOdometer: -5 });

    expect(draft.startDate).toBeUndefined();
    expect(draft.endOdometer).toBeUndefined();
  });
});

describe('ComplianceDocumentExtractionSpec', () => {
  const spec = new ComplianceDocumentExtractionSpec();

  it('normalizes a road tax receipt', () => {
    expect(
      spec.normalize({
        provider: 'RTO Pune (MH-12)',
        number: 'CH-2026-4471',
        startDate: '2026-03-02',
        amount: 24500,
      }),
    ).toEqual({
      provider: 'RTO Pune (MH-12)',
      number: 'CH-2026-4471',
      startDate: '2026-03-02T00:00:00.000Z',
      // Lifetime road tax has no expiry; nothing is invented for it.
      endDate: undefined,
      amount: 24500,
      notes: undefined,
    });
  });

  it('narrows the prompt to the requested compliance kind', () => {
    const puc = spec.buildPrompt([], { documentKind: 'puc' });
    const registration = spec.buildPrompt([], { documentKind: 'registration' });

    expect(puc).toContain('Pollution Under Control');
    expect(registration).toContain('Registration Certificate');
    expect(registration).not.toContain('Pollution Under Control');
  });

  it('falls back to self-identification when no kind hint is given', () => {
    expect(spec.buildPrompt([])).toContain('Identify whether this is');
  });
});
