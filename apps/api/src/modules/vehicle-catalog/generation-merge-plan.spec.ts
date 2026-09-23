import { describe, expect, it } from 'vitest';

import {
  isPlaceholderGeneration,
  planGenerationMerge,
  type MergeGenerationRow,
  type MergeModelRow,
} from './generation-merge-plan';

function generation(
  id: string,
  name: string,
  variants: string[],
  years: Partial<Pick<MergeGenerationRow, 'yearStart' | 'yearEnd' | 'isCurrent'>> = {},
): MergeGenerationRow {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    yearStart: null,
    yearEnd: null,
    isCurrent: true,
    ...years,
    variants: variants.map((variant) => ({
      id: `${id}:${variant}`,
      name: variant,
      slug: variant.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    })),
  };
}

function model(generations: MergeGenerationRow[]): MergeModelRow {
  return { id: 'model-1', label: 'Honda Amaze', generations };
}

describe('isPlaceholderGeneration', () => {
  it.each([
    ['Amaze (current)', true],
    ['Amaze lineup', true],
    ['Amaze (2024 refresh)', false],
    ['FZ-S Fi (V3 lineup)', false],
  ])('reads %j with no years as a placeholder: %s', (name, expected) => {
    expect(isPlaceholderGeneration(generation('g', name, []))).toBe(expected);
  });

  it('never treats a generation with a year, or one no longer current, as a placeholder', () => {
    expect(
      isPlaceholderGeneration(generation('g', 'Amaze (current)', [], { yearStart: 2020 })),
    ).toBe(false);
    expect(isPlaceholderGeneration(generation('g', 'Amaze lineup', [], { isCurrent: false }))).toBe(
      false,
    );
  });
});

describe('planGenerationMerge', () => {
  const official = generation('official', 'Amaze (2024 refresh)', ['V', 'VX', 'ZX'], {
    yearStart: 2024,
  });
  const carwale = generation('carwale', 'Amaze (current)', [
    'V | Petrol | Manual',
    'ZX | Petrol | Automatic',
  ]);
  const seed = generation('seed', 'Amaze lineup', ['V', 'VX', 'ZX']);

  it('folds both placeholders into the one real current generation', () => {
    const plan = planGenerationMerge(model([official, carwale, seed]));

    expect(plan).toMatchObject({
      kind: 'merge',
      into: { id: 'official', name: 'Amaze (2024 refresh)' },
      absorbed: [
        { id: 'carwale', name: 'Amaze (current)' },
        { id: 'seed', name: 'Amaze lineup' },
      ],
    });
  });

  it('moves new trims into it and folds a trim it already has into that trim', () => {
    const plan = planGenerationMerge(model([official, carwale, seed]));
    if (plan?.kind !== 'merge') throw new Error('expected a merge');

    expect(plan.moves.map((move) => move.variantName).sort()).toEqual([
      'V | Petrol | Manual',
      'ZX | Petrol | Automatic',
    ]);
    expect(plan.moves.every((move) => move.toGenerationId === 'official')).toBe(true);
    expect(plan.folds).toEqual([
      {
        variantId: 'seed:V',
        variantName: 'V',
        intoVariantId: 'official:V',
        intoGenerationId: 'official',
      },
      {
        variantId: 'seed:VX',
        variantName: 'VX',
        intoVariantId: 'official:VX',
        intoGenerationId: 'official',
      },
      {
        variantId: 'seed:ZX',
        variantName: 'ZX',
        intoVariantId: 'official:ZX',
        intoGenerationId: 'official',
      },
    ]);
  });

  it('folds a trim into an older generation that already carries its slug', () => {
    const fourthGen = generation('fourth', 'City (4th gen continuation)', ['4th Gen V'], {
      yearStart: 2020,
      yearEnd: 2023,
      isCurrent: false,
    });
    const fifth = generation('fifth', 'City (5th gen facelift)', ['V'], { yearStart: 2023 });
    const lineup = generation('lineup', 'City lineup', ['V', '4th Gen V']);

    const plan = planGenerationMerge(model([fifth, fourthGen, lineup]));
    if (plan?.kind !== 'merge') throw new Error('expected a merge');

    expect(plan.folds).toContainEqual({
      variantId: 'lineup:4th Gen V',
      variantName: '4th Gen V',
      intoVariantId: 'fourth:4th Gen V',
      intoGenerationId: 'fourth',
    });
    expect(plan.folds).toContainEqual(
      expect.objectContaining({ variantId: 'lineup:V', intoVariantId: 'fifth:V' }),
    );
    expect(plan.moves).toEqual([]);
  });

  it('folds a trim two placeholders share into the one that moved first', () => {
    const a = generation('carwale', 'Alcazar (current)', ['Signature']);
    const b = generation('seed', 'Alcazar lineup', ['Signature', 'Prestige']);

    const plan = planGenerationMerge(model([b, a]));
    if (plan?.kind !== 'merge') throw new Error('expected a merge');

    // No real generation: the CarWale placeholder absorbs the seed's.
    expect(plan.into).toEqual({ id: 'carwale', name: 'Alcazar (current)' });
    expect(plan.folds).toEqual([
      {
        variantId: 'seed:Signature',
        variantName: 'Signature',
        intoVariantId: 'carwale:Signature',
        intoGenerationId: 'carwale',
      },
    ]);
    expect(plan.moves).toEqual([
      { variantId: 'seed:Prestige', variantName: 'Prestige', toGenerationId: 'carwale' },
    ]);
  });

  it('merges across the make rows of one address and names every model row involved', () => {
    const suvRow = generation('official', 'Elevate (2023 launch)', ['V'], { yearStart: 2023 });
    const carRow = generation('carwale', 'Elevate (current)', ['V | Petrol | Manual']);

    const plan = planGenerationMerge({
      id: 'IN|car+suv+van|honda|elevate',
      label: 'Honda Elevate (car/suv)',
      modelIds: ['model-car', 'model-suv'],
      generations: [carRow, suvRow],
    });

    expect(plan).toMatchObject({
      kind: 'merge',
      modelIds: ['model-car', 'model-suv'],
      into: { id: 'official' },
      absorbed: [{ id: 'carwale' }],
      moves: [{ variantId: 'carwale:V | Petrol | Manual', toGenerationId: 'official' }],
    });
  });

  it('skips a model with two real current generations rather than guess', () => {
    const plan = planGenerationMerge(
      model([
        generation('125', 'Jupiter 125', ['Disc'], { yearStart: 2021 }),
        generation('110', 'Jupiter 110 (BS6)', ['ZX'], { yearStart: 2020 }),
        generation('seed', 'Jupiter lineup', ['ZX']),
      ]),
    );

    expect(plan).toEqual({
      kind: 'skip',
      modelId: 'model-1',
      label: 'Honda Amaze',
      reason: 'several-real-current-generations',
      generations: ['Jupiter 125', 'Jupiter 110 (BS6)', 'Jupiter lineup'],
    });
  });

  it('has nothing to do for a model with one current generation, or no placeholder', () => {
    expect(planGenerationMerge(model([official]))).toBeNull();
    expect(
      planGenerationMerge(
        model([
          official,
          generation('other', 'Amaze (2021 facelift)', ['S'], { yearStart: 2021, yearEnd: 2024 }),
        ]),
      ),
    ).toBeNull();
  });
});
