import { addDays, isBefore } from 'date-fns';

export type PaperStatus = 'valid' | 'ends-soon' | 'expired';

/** One vocabulary for every paper: policy, warranty, RC, PUC and road tax alike. */
export const paperStatusLabels: Record<PaperStatus, string> = {
  valid: 'Valid',
  'ends-soon': 'Ends soon',
  expired: 'Expired',
};

/** Within this many days of its end date, a paper ends soon. */
export const ENDS_SOON_DAYS = 30;

/** A paper with no end date (a lifetime road tax, most RCs) stays valid. */
export function paperStatus(endDate: Date | string | null, now = new Date()): PaperStatus {
  if (!endDate) return 'valid';
  const end = new Date(endDate);
  if (isBefore(end, now)) return 'expired';
  return isBefore(end, addDays(now, ENDS_SOON_DAYS)) ? 'ends-soon' : 'valid';
}

const WARRANTY_TYPE_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  extended: 'Extended',
  parts: 'Parts only',
  service: 'Service plan',
};

/**
 * A warranty's type is free text: the form writes "Manufacturer", a scan or an
 * import may write "manufacturer". Either reads as the form's own words.
 */
export function warrantyTypeLabel(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const known = WARRANTY_TYPE_LABELS[value.trim().toLowerCase()];
  if (known) return known;
  const text = value.trim().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
