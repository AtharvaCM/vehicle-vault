import { requiresPuc, type VehicleDocumentKind } from '@vehicle-vault/shared';

import { format } from '@/lib/format';

import type { DashboardVehicleHealth } from '../types/dashboard';

/** Kinds that count as a lapse when expired — warranty running out is not a compliance problem. */
const EXPIRY_KINDS: readonly VehicleDocumentKind[] = [
  'insurance',
  'puc',
  'registration',
  'road_tax',
];
const EXPIRING_KINDS: readonly VehicleDocumentKind[] = [
  'insurance',
  'puc',
  'registration',
  'road_tax',
  'warranty',
];

export type VehicleDocumentsDescription = {
  text: string;
  tone: 'danger' | 'warning' | 'ok';
};

/**
 * One line for the vehicle card's "Documents" row, in precedence order:
 * expired > missing insurance > missing PUC > expiring > valid. An electric
 * vehicle is exempt from PUC, so it is never told one is missing; a PUC it has
 * on file still reads like any other document.
 */
export function describeVehicleDocuments(
  vehicle: Pick<DashboardVehicleHealth, 'documents' | 'fuelType'>,
  today: Date = new Date(),
): VehicleDocumentsDescription {
  const { documents } = vehicle;
  // An API that predates `fuelType` asks every vehicle for a PUC, so this does too.
  const pucRequired = vehicle.fuelType === undefined || requiresPuc(vehicle.fuelType);
  const puc = documents.puc?.state === 'missing' ? undefined : documents.puc;

  for (const kind of EXPIRY_KINDS) {
    const document = documents[kind];

    if (document?.state === 'expired' && document.endDate) {
      return {
        text: `${format.enumLabel('documentKind', kind)} · ${format.relativeDue(document.endDate, {
          mode: 'ends',
          now: today,
          // An expired paper ended in the past even if the day count says otherwise.
          days: Math.min(-1, format.daysUntil(document.endDate, today) ?? -1),
        })}`,
        tone: 'danger',
      };
    }
  }

  if (!documents.insurance || documents.insurance.state === 'missing') {
    return { text: 'No insurance on file', tone: 'warning' };
  }

  if (pucRequired && !puc) {
    return { text: 'No PUC on file', tone: 'warning' };
  }

  for (const kind of EXPIRING_KINDS) {
    const document = documents[kind];

    if (document?.state === 'expiring' && document.endDate) {
      return {
        text: `${format.enumLabel('documentKind', kind)} · ${format.relativeDue(document.endDate, {
          mode: 'ends',
          now: today,
          days: Math.max(0, format.daysUntil(document.endDate, today) ?? 0),
        })}`,
        tone: 'warning',
      };
    }
  }

  const endDates = [documents.insurance.endDate, puc?.endDate]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));
  const earliest = endDates.length > 0 ? Math.min(...endDates) : null;
  const valid = puc ? 'Insurance & PUC valid' : 'Insurance valid';

  return {
    text: earliest ? `${valid} · to ${format.date(earliest)}` : valid,
    tone: 'ok',
  };
}
