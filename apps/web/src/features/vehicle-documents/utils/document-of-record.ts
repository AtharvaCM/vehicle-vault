import type { VehicleDocument } from '@vehicle-vault/shared';

const startRank = (document: VehicleDocument) =>
  document.startDate ? new Date(document.startDate).getTime() : Number.NEGATIVE_INFINITY;

const endRank = (document: VehicleDocument) =>
  document.endDate ? new Date(document.endDate).getTime() : Number.POSITIVE_INFINITY;

/**
 * The vehicle's document of record among documents of one kind: the one the
 * dashboard shows and the alerts follow. It is the API's rule in
 * document-recency.ts, restated here so the page offers "Renew" on the same
 * document the alerts are about: a later start wins; a document with no start
 * ranks below any with one; on a tie, an open-ended one outranks a dated one.
 */
export function documentOfRecord(documents: VehicleDocument[]): VehicleDocument | undefined {
  let current: VehicleDocument | undefined;
  for (const document of documents) {
    if (!current) {
      current = document;
      continue;
    }
    // Compared, never subtracted: two undated documents are both -Infinity.
    const newer =
      startRank(document) !== startRank(current)
        ? startRank(document) > startRank(current)
        : endRank(document) > endRank(current);
    if (newer) current = document;
  }
  return current;
}
