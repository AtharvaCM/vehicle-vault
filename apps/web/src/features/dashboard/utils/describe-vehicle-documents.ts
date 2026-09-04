import type { VehicleDocumentKind } from '@vehicle-vault/shared';

import { formatDate } from '@/lib/utils/format-date';

import type { DashboardVehicleHealth } from '../types/dashboard';
import { calendarDaysUntil } from './format-due';

const KIND_LABELS: Record<VehicleDocumentKind, string> = {
  insurance: 'Insurance',
  puc: 'PUC',
  registration: 'Registration',
  road_tax: 'Road tax',
  warranty: 'Warranty',
};

/** Kinds that count as a lapse when expired — warranty running out is not a compliance problem. */
const EXPIRY_KINDS: readonly VehicleDocumentKind[] = ['insurance', 'puc', 'registration', 'road_tax'];
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

function pluralDays(count: number) {
  return `${count} day${count === 1 ? '' : 's'}`;
}

/**
 * One line for the vehicle card's "Documents" row, in precedence order:
 * expired > missing insurance > missing PUC > expiring > valid.
 */
export function describeVehicleDocuments(
  documents: DashboardVehicleHealth['documents'],
  today: Date = new Date(),
): VehicleDocumentsDescription {
  for (const kind of EXPIRY_KINDS) {
    const document = documents[kind];

    if (document?.state === 'expired' && document.endDate) {
      const daysAgo = Math.max(0, -calendarDaysUntil(document.endDate, today));

      return {
        text: `${KIND_LABELS[kind]} expired ${pluralDays(daysAgo)} ago`,
        tone: 'danger',
      };
    }
  }

  if (!documents.insurance || documents.insurance.state === 'missing') {
    return { text: 'No insurance on file', tone: 'warning' };
  }

  if (!documents.puc || documents.puc.state === 'missing') {
    return { text: 'No PUC on file', tone: 'warning' };
  }

  for (const kind of EXPIRING_KINDS) {
    const document = documents[kind];

    if (document?.state === 'expiring' && document.endDate) {
      const days = Math.max(0, calendarDaysUntil(document.endDate, today));

      return {
        text:
          days === 0
            ? `${KIND_LABELS[kind]} expires today`
            : `${KIND_LABELS[kind]} expires in ${pluralDays(days)}`,
        tone: 'warning',
      };
    }
  }

  const endDates = [documents.insurance.endDate, documents.puc.endDate]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));
  const earliest = endDates.length > 0 ? Math.min(...endDates) : null;

  return {
    text: earliest ? `Insurance & PUC valid · to ${formatDate(earliest)}` : 'Insurance & PUC valid',
    tone: 'ok',
  };
}
