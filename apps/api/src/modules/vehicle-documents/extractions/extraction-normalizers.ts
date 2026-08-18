import type { ExtractionContext } from '../../extraction/types';

/** Shared by the vehicle-document specs so their normalisers stay identical. */
export function normalizeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeDate(value: string | undefined): string | undefined {
  const trimmed = normalizeString(value);
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function normalizeNonNegativeNumber(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return undefined;
  return Number(value);
}

export function normalizeNonNegativeInteger(value: number | undefined): number | undefined {
  const numeric = normalizeNonNegativeNumber(value);
  return numeric === undefined ? undefined : Math.round(numeric);
}

/** Flattens the vehicle hints into a prompt fragment, or nothing when empty. */
export function vehicleContextHint(context?: ExtractionContext): string | undefined {
  if (!context) return undefined;

  const hints = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');

  return hints || undefined;
}
