import type { VehicleDocument } from '@vehicle-vault/shared';

/**
 * True when `candidate` is the vehicle's document of record over `current`
 * for their shared kind: a later `startDate` wins outright; on a tie, an
 * open-ended document (`endDate: null`) outranks a dated one so an older
 * open-ended record can never mask a newer dated renewal.
 */
export function isMoreRecentDocument(
  candidate: VehicleDocument,
  current: VehicleDocument,
): boolean {
  const startDifference = candidate.startDate.getTime() - current.startDate.getTime();
  if (startDifference !== 0) return startDifference > 0;

  return endDateRank(candidate) > endDateRank(current);
}

function endDateRank(document: VehicleDocument): number {
  return document.endDate === null ? Number.POSITIVE_INFINITY : document.endDate.getTime();
}

/** The single most current document in a same-(vehicle, kind) list, or undefined if empty. */
export function pickLatestDocument(documents: VehicleDocument[]): VehicleDocument | undefined {
  let latest: VehicleDocument | undefined;
  for (const document of documents) {
    if (!latest || isMoreRecentDocument(document, latest)) {
      latest = document;
    }
  }

  return latest;
}
