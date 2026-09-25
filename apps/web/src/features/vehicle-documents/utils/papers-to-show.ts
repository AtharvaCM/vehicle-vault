import type { VehicleDocument, VehicleDocumentKind } from '@vehicle-vault/shared';

import { documentOfRecord } from './document-of-record';

/** The papers Show papers holds, in the order someone asking for them wants them. */
export const SHOW_PAPERS_ORDER = [
  'insurance',
  'puc',
  'road_tax',
  'registration',
  'warranty',
] as const satisfies readonly VehicleDocumentKind[];

/** Each paper's tab: short, so five fit across a phone. */
export const PAPER_TAB_LABELS: Record<VehicleDocumentKind, string> = {
  insurance: 'Insurance',
  puc: 'PUC',
  road_tax: 'Road tax',
  registration: 'RC',
  warranty: 'Warranty',
};

/**
 * One paper per kind the vehicle has, in Show papers order: the document of
 * record, the one the alerts follow. An old per-document link names a document
 * of its own; that one stands in for its kind, so the link still opens what it
 * pointed at.
 */
export function papersToShow(
  documents: readonly VehicleDocument[],
  requestedDocumentId?: string,
): VehicleDocument[] {
  const requested = requestedDocumentId
    ? documents.find((document) => document.id === requestedDocumentId)
    : undefined;

  return SHOW_PAPERS_ORDER.flatMap((kind) => {
    if (requested?.kind === kind) return [requested];
    const current = documentOfRecord(documents.filter((document) => document.kind === kind));
    return current ? [current] : [];
  });
}
