import { describe, expect, it } from 'vitest';

import { detailedTrimRoot, planTrimMerges, type TrimRow } from './trim-merge-plan';

const trims = (...names: string[]): TrimRow[] => names.map((name) => ({ id: name, name }));

describe('detailedTrimRoot', () => {
  it('reads the trim in front of the detail segments', () => {
    expect(detailedTrimRoot('VX | Petrol | Manual | Elite Pack')).toBe('VX');
    expect(detailedTrimRoot('ZX Plus | Petrol | Automatic (CVT)')).toBe('ZX Plus');
  });

  it('has no root for a plain name or one with an empty trim', () => {
    expect(detailedTrimRoot('ZX')).toBeNull();
    expect(detailedTrimRoot('| Petrol | Automatic')).toBeNull();
  });
});

describe('planTrimMerges', () => {
  it('folds a model-prefixed trim into the clean one', () => {
    expect(planTrimMerges('XUV 3XO', trims('AX5', '3XO AX5', 'MX1', '3XO MX1'))).toEqual([
      {
        variantId: '3XO AX5',
        variantName: '3XO AX5',
        intoVariantId: 'AX5',
        intoVariantName: 'AX5',
        reason: 'model-prefixed',
      },
      {
        variantId: '3XO MX1',
        variantName: '3XO MX1',
        intoVariantId: 'MX1',
        intoVariantName: 'MX1',
        reason: 'model-prefixed',
      },
    ]);
  });

  it('matches any tail of the model name, and punctuation loosely', () => {
    const folds = planTrimMerges(
      'Grand i10 Nios',
      trims('Sportz', 'i10 Nios Sportz', 'ZX (O)', 'Nios ZX (O)'),
    );

    expect(folds.map((fold) => [fold.variantName, fold.intoVariantName])).toEqual([
      ['i10 Nios Sportz', 'Sportz'],
      ['Nios ZX (O)', 'ZX (O)'],
    ]);
  });

  it('folds a bare trim into the first of its detailed children', () => {
    const folds = planTrimMerges(
      'Amaze',
      trims('V', 'V | Petrol | Manual', 'V | Petrol | Automatic', 'ZX', 'ZX | Petrol | Manual'),
    );

    expect(folds).toEqual([
      {
        variantId: 'V',
        variantName: 'V',
        intoVariantId: 'V | Petrol | Automatic',
        intoVariantName: 'V | Petrol | Automatic',
        reason: 'parent-of-detailed',
      },
      {
        variantId: 'ZX',
        variantName: 'ZX',
        intoVariantId: 'ZX | Petrol | Manual',
        intoVariantName: 'ZX | Petrol | Manual',
        reason: 'parent-of-detailed',
      },
    ]);
  });

  it('does not treat a longer trim name as a child ("ZX Plus | …" is not a "ZX")', () => {
    expect(planTrimMerges('City', trims('ZX', 'ZX Plus | Petrol | Manual'))).toEqual([]);
  });

  it('leaves trims that only share a prefix alone', () => {
    expect(
      planTrimMerges('Creta', trims('SX', 'SX (O)', 'S', 'S (O) Knight', 'Asta', 'Asta (O)')),
    ).toEqual([]);
  });

  it('has nothing to fold in a generation with no near-duplicates', () => {
    expect(
      planTrimMerges('Nexon', trims('Creative', 'Creative Plus (PS)', 'Pure', 'Pure Plus')),
    ).toEqual([]);
  });

  it('never folds into a trim that is itself folded away', () => {
    // "Amaze V" folds into "V", and "V" folds into its detailed child: the
    // first fold would point at a deleted row, so it is dropped.
    const folds = planTrimMerges('Amaze', trims('V', 'Amaze V', 'V | Petrol | Manual'));

    expect(folds.map((fold) => [fold.variantName, fold.intoVariantName])).toEqual([
      ['V', 'V | Petrol | Manual'],
    ]);
  });
});
