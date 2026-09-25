import type { TyreCondition, TyreConditionLevel } from '@vehicle-vault/shared';

import { format } from '@/lib/format';

/** Worst first, as the API ranks them for the vehicle-wide verdict. */
const LEVEL_RANK: Record<TyreConditionLevel, number> = {
  illegal: 0,
  replace: 1,
  warn: 2,
  unknown: 3,
  healthy: 4,
};

/** A condition in two or three words, for a wheel. */
export const LEVEL_WORDS: Record<TyreConditionLevel, string> = {
  illegal: 'Not roadworthy',
  replace: 'Replace soon',
  warn: 'Wearing',
  healthy: 'Good',
  unknown: 'Not measured',
};

function tread(mm: number) {
  return `${mm.toFixed(1)} mm`;
}

/** "2 yrs", "1 yr", "under a year"; null when the DOT date is unknown. */
export function tyreAge(ageYears: number | null): string | null {
  if (ageYears == null) return null;
  const years = Math.floor(ageYears);
  if (years < 1) return 'under a year';
  return `${years} yr${years === 1 ? '' : 's'}`;
}

/** What a wheel reads: "3.4 mm · 2 yrs", or "Tread not measured · 5 yrs". */
export function wheelReading(condition: TyreCondition): string {
  return [
    condition.treadDepthMm != null ? tread(condition.treadDepthMm) : 'Tread not measured',
    tyreAge(condition.ageYears),
  ]
    .filter(Boolean)
    .join(' · ');
}

function positionName(condition: TyreCondition) {
  return `${format.enumLabel('tyrePosition', condition.position)} tyre`;
}

/** The figure that put the tyre where it is: its tread, or its age when age decided. */
function deciding(condition: TyreCondition) {
  if (condition.reason === 'age' && condition.ageYears != null) {
    return `${Math.floor(condition.ageYears)} years old`;
  }
  return condition.treadDepthMm != null ? tread(condition.treadDepthMm) : null;
}

export type TyreVerdict = { level: TyreConditionLevel; text: string };

/**
 * One line for the whole set, led by the tyre that needs the most attention:
 * "Rear tyre: 1.9 mm — replace soon". The levels are the API's, from the
 * shared tread and age limits; nothing is graded here. Null with no tyres.
 */
export function tyreVerdict(conditions: TyreCondition[]): TyreVerdict | null {
  if (conditions.length === 0) return null;

  const worst = [...conditions].sort(
    (a, b) =>
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
      (a.treadDepthMm ?? Infinity) - (b.treadDepthMm ?? Infinity),
  )[0]!;
  const figure = deciding(worst);
  const lead = figure ? `${positionName(worst)}: ${figure}` : positionName(worst);

  switch (worst.level) {
    case 'illegal':
      return { level: 'illegal', text: `${lead} — below the legal limit, replace it now` };
    case 'replace':
      return { level: 'replace', text: `${lead} — replace soon` };
    case 'warn':
      return {
        level: 'warn',
        text:
          worst.reason === 'age'
            ? `${lead} — look it over closely`
            : `${lead} — wearing, plan a set`,
      };
    case 'unknown':
      return {
        level: 'unknown',
        text: `${positionName(worst)}: not measured yet — log an inspection`,
      };
    case 'healthy': {
      const least = Math.min(...conditions.map((condition) => condition.treadDepthMm ?? Infinity));
      const all = conditions.length === 2 ? 'Both tyres' : `All ${conditions.length} tyres`;
      return {
        level: 'healthy',
        text: Number.isFinite(least)
          ? `${all} look good — least tread ${tread(least)}`
          : `${all} look good`,
      };
    }
  }
}
