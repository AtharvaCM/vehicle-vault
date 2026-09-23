import { format } from '@/lib/format';

/**
 * The reminder form's "Repeats" choice, and how it maps to the API's repeat
 * rule (`repeatEveryMonths` / `repeatEveryKm`, whichever comes first when
 * both are set).
 */
export type RepeatChoice = 'none' | 'six-months' | 'yearly' | 'distance' | 'custom';

export const repeatChoiceOptions: { value: RepeatChoice; label: string }[] = [
  { value: 'none', label: 'Doesn’t repeat' },
  { value: 'six-months', label: 'Every 6 months' },
  { value: 'yearly', label: 'Every year' },
  { value: 'distance', label: 'Every … km' },
  { value: 'custom', label: 'Custom' },
];

export type RepeatRule = {
  repeatEveryMonths: number | null;
  repeatEveryKm: number | null;
};

/** The choice that shows a stored rule. */
export function toRepeatChoice(rule: {
  repeatEveryMonths?: number | null;
  repeatEveryKm?: number | null;
}): RepeatChoice {
  const months = rule.repeatEveryMonths ?? null;
  const km = rule.repeatEveryKm ?? null;

  if (months === null && km === null) return 'none';
  if (km === null && months === 6) return 'six-months';
  if (km === null && months === 12) return 'yearly';
  if (months === null) return 'distance';
  return 'custom';
}

/** The rule a choice stands for; `distance` and `custom` read the typed numbers. */
export function toRepeatRule(
  choice: RepeatChoice,
  typed: { repeatEveryMonths?: number; repeatEveryKm?: number },
): RepeatRule {
  switch (choice) {
    case 'none':
      return { repeatEveryMonths: null, repeatEveryKm: null };
    case 'six-months':
      return { repeatEveryMonths: 6, repeatEveryKm: null };
    case 'yearly':
      return { repeatEveryMonths: 12, repeatEveryKm: null };
    case 'distance':
      return { repeatEveryMonths: null, repeatEveryKm: typed.repeatEveryKm ?? null };
    case 'custom':
      return {
        repeatEveryMonths: typed.repeatEveryMonths ?? null,
        repeatEveryKm: typed.repeatEveryKm ?? null,
      };
  }
}

function formatMonths(months: number) {
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? 'year' : `${years} years`;
  }
  return months === 1 ? 'month' : `${months} months`;
}

/** "Repeats every year", "Repeats every 10,000 km or 12 months, whichever comes first". */
export function describeRepeatRule(rule: {
  repeatEveryMonths?: number | null;
  repeatEveryKm?: number | null;
}): string {
  const months = rule.repeatEveryMonths ?? null;
  const km = rule.repeatEveryKm ?? null;

  if (months === null && km === null) {
    return 'Doesn’t repeat';
  }

  const distance = km === null ? null : format.distance(km);

  if (months === null) {
    return `Repeats every ${distance}`;
  }

  if (distance === null) {
    return `Repeats every ${formatMonths(months)}`;
  }

  return `Repeats every ${distance} or ${months} ${months === 1 ? 'month' : 'months'}, whichever comes first`;
}
