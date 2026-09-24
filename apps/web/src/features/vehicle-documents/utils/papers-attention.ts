import type { VehicleDocument, VehicleDocumentKind } from '@vehicle-vault/shared';

import { format } from '@/lib/format';

import { documentOfRecord } from './document-of-record';

/** A lapse in any of these is a problem on the road; a warranty ending is not. */
const EXPIRY_KINDS: readonly VehicleDocumentKind[] = [
  'insurance',
  'puc',
  'registration',
  'road_tax',
];
const EXPIRING_KINDS: readonly VehicleDocumentKind[] = [...EXPIRY_KINDS, 'warranty'];

/** How far ahead a paper running out counts as needing attention. */
export const PAPERS_EXPIRING_WITHIN_DAYS = 30;

export type PapersAttention = {
  expired: VehicleDocumentKind[];
  expiring: VehicleDocumentKind[];
  /** "1 paper expired", "2 papers run out soon", or null when all is well. */
  label: string | null;
  tone: 'late' | 'soon' | null;
};

/**
 * Whether the vehicle's papers need looking at: the Papers tab's status dot.
 * Only each kind's document of record counts (the one alerts follow), so an
 * old policy that was since renewed never raises it.
 */
export function papersAttention(
  documents: readonly VehicleDocument[],
  today: Date = new Date(),
): PapersAttention {
  const expired: VehicleDocumentKind[] = [];
  const expiring: VehicleDocumentKind[] = [];

  for (const kind of EXPIRING_KINDS) {
    const current = documentOfRecord(documents.filter((document) => document.kind === kind));
    if (!current?.endDate) continue;

    const days = format.daysUntil(current.endDate, today);
    if (days === null) continue;

    if (days < 0) {
      if (EXPIRY_KINDS.includes(kind)) expired.push(kind);
    } else if (days <= PAPERS_EXPIRING_WITHIN_DAYS) {
      expiring.push(kind);
    }
  }

  const parts = [
    expired.length
      ? `${expired.length} ${expired.length === 1 ? 'paper' : 'papers'} expired`
      : null,
    expiring.length
      ? `${expiring.length} ${expiring.length === 1 ? 'paper runs' : 'papers run'} out soon`
      : null,
  ].filter(Boolean);

  return {
    expired,
    expiring,
    label: parts.length ? parts.join(', ') : null,
    tone: expired.length ? 'late' : expiring.length ? 'soon' : null,
  };
}
