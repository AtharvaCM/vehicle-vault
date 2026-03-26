import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';

import type { Vehicle } from '../types/vehicle';

export type VehicleOdometerHistoryEntry = {
  id: string;
  label: string;
  date: string;
  odometer: number;
  kind: 'current' | 'service';
  totalCost?: number;
};

export type VehicleServiceInsights = {
  averageDaysBetweenServices: number | null;
  averageKmBetweenServices: number | null;
  averageSpend: number | null;
  history: VehicleOdometerHistoryEntry[];
  kmSinceLastService: number | null;
  latestService: MaintenanceRecord | null;
  nextDueDateDeltaDays: number | null;
  nextDueOdometerDelta: number | null;
};

type GetVehicleServiceInsightsArgs = {
  vehicle: Vehicle;
  records: MaintenanceRecord[];
  now?: Date;
};

export function getVehicleServiceInsights({
  vehicle,
  records,
  now = new Date(),
}: GetVehicleServiceInsightsArgs): VehicleServiceInsights {
  const sortedRecords = [...records].sort(
    (left, right) => Date.parse(left.serviceDate) - Date.parse(right.serviceDate),
  );
  const latestService = sortedRecords.at(-1) ?? null;
  const positiveKmDiffs: number[] = [];
  const positiveDayDiffs: number[] = [];

  for (let index = 1; index < sortedRecords.length; index += 1) {
    const previous = sortedRecords[index - 1]!;
    const current = sortedRecords[index]!;
    const kmDiff = current.odometer - previous.odometer;
    const dayDiff =
      (Date.parse(current.serviceDate) - Date.parse(previous.serviceDate)) / (1000 * 60 * 60 * 24);

    if (kmDiff > 0) {
      positiveKmDiffs.push(kmDiff);
    }

    if (dayDiff > 0) {
      positiveDayDiffs.push(dayDiff);
    }
  }

  const history = buildHistory(vehicle, sortedRecords);
  const kmSinceLastService =
    latestService && vehicle.odometer >= latestService.odometer
      ? vehicle.odometer - latestService.odometer
      : null;
  const nextDueOdometerDelta =
    latestService?.nextDueOdometer !== undefined && latestService?.nextDueOdometer !== null
      ? latestService.nextDueOdometer - vehicle.odometer
      : null;
  const nextDueDateDeltaDays = latestService?.nextDueDate
    ? Math.ceil((Date.parse(latestService.nextDueDate) - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    averageDaysBetweenServices: average(positiveDayDiffs),
    averageKmBetweenServices: average(positiveKmDiffs),
    averageSpend: average(sortedRecords.map((record) => record.totalCost)),
    history,
    kmSinceLastService,
    latestService,
    nextDueDateDeltaDays,
    nextDueOdometerDelta,
  };
}

function buildHistory(vehicle: Vehicle, sortedRecords: MaintenanceRecord[]) {
  const serviceHistory: VehicleOdometerHistoryEntry[] = sortedRecords
    .slice()
    .reverse()
    .map((record) => ({
      id: record.id,
      label: record.workshopName?.trim() || 'Service entry',
      date: record.serviceDate,
      odometer: record.odometer,
      kind: 'service',
      totalCost: record.totalCost,
    }));

  const currentEntry: VehicleOdometerHistoryEntry = {
    id: `${vehicle.id}-current`,
    label: 'Current vehicle reading',
    date: vehicle.updatedAt,
    odometer: vehicle.odometer,
    kind: 'current',
  };

  if (serviceHistory[0]?.odometer === vehicle.odometer) {
    return serviceHistory;
  }

  return [currentEntry, ...serviceHistory];
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
