import { describe, expect, it } from 'vitest';

import { ClaimDocumentExtractionSpec } from './claim-document.extraction';

describe('ClaimDocumentExtractionSpec.normalize', () => {
  const spec = new ClaimDocumentExtractionSpec();

  it('passes through valid fields', () => {
    expect(
      spec.normalize({
        confidence: 0.92,
        claimNumber: 'CL/2026/00123',
        grossAmount: 45000,
        insurerPaidAmount: 40000,
        filedDate: '2026-01-10',
        settledDate: '2026-02-05',
        vendorName: 'Pristine Auto Body',
        notes: 'Front bumper + headlamp replacement',
      }),
    ).toMatchObject({
      confidence: 0.92,
      claimNumber: 'CL/2026/00123',
      grossAmount: 45000,
      insurerPaidAmount: 40000,
      vendorName: 'Pristine Auto Body',
      notes: 'Front bumper + headlamp replacement',
    });
  });

  it('clamps confidence into [0, 1]', () => {
    expect(spec.normalize({ confidence: 1.7 }).confidence).toBe(1);
    expect(spec.normalize({ confidence: -0.3 }).confidence).toBe(0);
    expect(spec.normalize({ confidence: Number.NaN }).confidence).toBeUndefined();
  });

  it('clamps insurerPaidAmount to grossAmount when model overshoots', () => {
    const result = spec.normalize({ grossAmount: 1000, insurerPaidAmount: 1500 });
    expect(result.insurerPaidAmount).toBe(1000);
  });

  it('leaves insurerPaidAmount alone when gross is missing', () => {
    const result = spec.normalize({ insurerPaidAmount: 500 });
    expect(result.insurerPaidAmount).toBe(500);
  });

  it('drops negative numbers and blank strings', () => {
    expect(
      spec.normalize({
        grossAmount: -10,
        claimNumber: '   ',
      }),
    ).toMatchObject({
      grossAmount: undefined,
      claimNumber: undefined,
    });
  });

  it('handles null input', () => {
    expect(spec.normalize(null)).toMatchObject({
      confidence: undefined,
      claimNumber: undefined,
      grossAmount: undefined,
    });
  });
});
