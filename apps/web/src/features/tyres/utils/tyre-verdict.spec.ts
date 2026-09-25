import { TyrePosition, type TyreCondition } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { tyreAge, tyreVerdict, wheelReading } from './tyre-verdict';

function condition(overrides: Partial<TyreCondition>): TyreCondition {
  return {
    tyreId: 't',
    position: TyrePosition.Front,
    level: 'healthy',
    reason: 'none',
    summary: '',
    treadDepthMm: 5,
    ageYears: 2.4,
    kmOnTyre: 1000,
    estimatedKmRemaining: null,
    lastInspectedAt: null,
    ...overrides,
  };
}

describe('tyreVerdict', () => {
  it('leads with the tyre that needs the most attention', () => {
    expect(
      tyreVerdict([
        condition({ position: TyrePosition.Front, treadDepthMm: 3.4 }),
        condition({
          position: TyrePosition.Rear,
          level: 'replace',
          reason: 'tread',
          treadDepthMm: 1.9,
        }),
      ]),
    ).toEqual({ level: 'replace', text: 'Rear tyre: 1.9 mm — replace soon' });
  });

  it('names the age when age decided', () => {
    expect(
      tyreVerdict([condition({ level: 'replace', reason: 'age', treadDepthMm: 5, ageYears: 6.3 })])
        ?.text,
    ).toBe('Front tyre: 6 years old — replace soon');
  });

  it('says below the legal limit plainly', () => {
    expect(
      tyreVerdict([condition({ level: 'illegal', reason: 'tread', treadDepthMm: 1.4 })])?.text,
    ).toBe('Front tyre: 1.4 mm — below the legal limit, replace it now');
  });

  it('asks for an inspection before calling a set good', () => {
    expect(
      tyreVerdict([
        condition({ position: TyrePosition.Front }),
        condition({ position: TyrePosition.Rear, level: 'unknown', treadDepthMm: null }),
      ])?.text,
    ).toBe('Rear tyre: not measured yet — log an inspection');
  });

  it('says a good set is good, with its least tread', () => {
    expect(
      tyreVerdict([
        condition({ position: TyrePosition.Front, treadDepthMm: 6.1 }),
        condition({ position: TyrePosition.Rear, treadDepthMm: 5.2 }),
      ])?.text,
    ).toBe('Both tyres look good — least tread 5.2 mm');
  });

  it('is null with no tyres', () => {
    expect(tyreVerdict([])).toBeNull();
  });
});

describe('wheelReading', () => {
  it('reads tread and age', () => {
    expect(wheelReading(condition({ treadDepthMm: 3.4, ageYears: 2.9 }))).toBe('3.4 mm · 2 yrs');
    expect(wheelReading(condition({ treadDepthMm: null, ageYears: null }))).toBe(
      'Tread not measured',
    );
    expect(tyreAge(0.4)).toBe('under a year');
    expect(tyreAge(1.2)).toBe('1 yr');
  });
});
