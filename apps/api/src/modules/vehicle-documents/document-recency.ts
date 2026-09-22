import type { VehicleDocument } from '@vehicle-vault/shared';

/**
 * True when `candidate` is the vehicle's document of record over `current`
 * for their shared kind: a later `startDate` wins outright; on a tie, an
 * open-ended document (`endDate: null`) outranks a dated one so an older
 * open-ended record can never mask a newer dated renewal.
 *
 * A document that records no start date ranks below every dated one, and two
 * of them fall through to their expiry — a renewal captured as an expiry alone
 * should still displace the one it renews.
 */
export function isMoreRecentDocument(
  candidate: VehicleDocument,
  current: VehicleDocument,
): boolean {
  // Compared rather than subtracted: two undated documents are both
  // -Infinity, and the difference of those is NaN.
  const candidateStart = startDateRank(candidate);
  const currentStart = startDateRank(current);
  if (candidateStart !== currentStart) return candidateStart > currentStart;

  return endDateRank(candidate) > endDateRank(current);
}

function startDateRank(document: VehicleDocument): number {
  return document.startDate === null ? Number.NEGATIVE_INFINITY : document.startDate.getTime();
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
