import { TyrePosition, type Tyre, type TyreInspection } from '@vehicle-vault/shared';

import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';
import { format } from '@/lib/format';

export type TyreHistoryItem = {
  key: string;
  kind: 'inspection' | 'fitted' | 'service';
  /** When it happened: what the list sorts by. */
  at: string;
  title: string;
  /** Date, reading and, for a service, where and what it cost. */
  details: string[];
  /** A service opens its record. */
  recordId?: string;
};

/** "front 3.4 mm, rear 1.9 mm · 32 psi": each tyre's reading, in its own words. */
/** Wheel order: the fronts, the rears, then the spare. */
const POSITION_ORDER: TyrePosition[] = [
  TyrePosition.Front,
  TyrePosition.FrontLeft,
  TyrePosition.FrontRight,
  TyrePosition.Rear,
  TyrePosition.RearLeft,
  TyrePosition.RearRight,
  TyrePosition.Spare,
];

function describeWalkaround(readings: TyreInspection[], tyreById: Map<string, Tyre>) {
  const order = (reading: TyreInspection) => {
    const position = tyreById.get(reading.tyreId)?.position;
    return position ? POSITION_ORDER.indexOf(position) : POSITION_ORDER.length;
  };

  return [...readings]
    .sort((a, b) => order(a) - order(b))
    .map((reading) => {
      const tyre = tyreById.get(reading.tyreId);
      const where = tyre ? format.enumLabel('tyrePosition', tyre.position).toLowerCase() : 'a tyre';
      const figures = [
        reading.treadDepthMm != null
          ? `${format.number(reading.treadDepthMm, { decimals: 1 })} mm`
          : null,
        reading.pressurePsi != null
          ? `${format.number(reading.pressurePsi, { decimals: 0 })} psi`
          : null,
      ].filter(Boolean);
      return `${where} ${figures.join(' · ')}`;
    })
    .join(', ');
}

/**
 * Tyres fitted together (a set, or the first setup) are one entry: "Fitted
 * 4 tyres · MRF ZLX". One fitted alone names its position.
 */
function fittings(tyres: Tyre[]): TyreHistoryItem[] {
  const groups = new Map<string, Tyre[]>();
  for (const tyre of tyres) {
    const key = [tyre.fittedDate, tyre.fittedOdometer, tyre.brand, tyre.model, tyre.size].join('|');
    groups.set(key, [...(groups.get(key) ?? []), tyre]);
  }

  return [...groups.entries()].map(([key, group]) => {
    const first = group[0]!;
    const name = [first.brand, first.model].filter(Boolean).join(' ');
    const what =
      group.length === 1
        ? `Fitted ${format.enumLabel('tyrePosition', first.position).toLowerCase()}`
        : `Fitted ${group.length} tyres`;
    return {
      key: `fitted:${key}`,
      kind: 'fitted' as const,
      at: first.fittedDate,
      title: name ? `${what} · ${name}` : what,
      details: [
        format.date(first.fittedDate),
        format.odometer(first.fittedOdometer),
        first.size,
      ].filter((detail): detail is string => Boolean(detail)),
    };
  });
}

/**
 * One list of what happened to the tyres, newest first: inspections (the
 * readings of one walk-around together), tyres fitted, and the tyre services
 * logged (rotations, alignments, replacements, punctures). `records` are the
 * confirmed tyre services only.
 */
export function tyreHistory({
  tyres,
  readings,
  records,
}: {
  tyres: Tyre[];
  readings: TyreInspection[];
  records: MaintenanceRecord[];
}): TyreHistoryItem[] {
  const tyreById = new Map(tyres.map((tyre) => [tyre.id, tyre]));

  // A walk-around logs one reading per tyre at the same moment and reading.
  const walkarounds = new Map<string, TyreInspection[]>();
  for (const reading of readings) {
    const key = `${reading.inspectedAt}|${reading.odometer}`;
    walkarounds.set(key, [...(walkarounds.get(key) ?? []), reading]);
  }

  const items: TyreHistoryItem[] = [
    ...[...walkarounds.entries()].map(([key, group]) => ({
      key: `inspection:${key}`,
      kind: 'inspection' as const,
      at: group[0]!.inspectedAt,
      title: `Inspection · ${describeWalkaround(group, tyreById)}`,
      details: [format.date(group[0]!.inspectedAt), format.odometer(group[0]!.odometer)],
    })),
    ...fittings(tyres),
    ...records.map((record) => ({
      key: `service:${record.id}`,
      kind: 'service' as const,
      at: record.serviceDate,
      title: format.enumLabel('maintenanceCategory', record.category),
      details: [
        format.date(record.serviceDate),
        format.odometer(record.odometer),
        record.workshopName?.trim() || null,
        Number(record.totalCost) > 0 ? format.money(Number(record.totalCost)) : null,
      ].filter((detail): detail is string => Boolean(detail)),
      recordId: record.id,
    })),
  ];

  // At the same moment a tyre is fitted before it is first inspected, so, newest
  // first, the inspection comes before the fitting.
  const sameMomentOrder: Record<TyreHistoryItem['kind'], number> = {
    service: 0,
    inspection: 1,
    fitted: 2,
  };
  return items.sort(
    (a, b) =>
      Date.parse(b.at) - Date.parse(a.at) ||
      sameMomentOrder[a.kind] - sameMomentOrder[b.kind] ||
      a.key.localeCompare(b.key),
  );
}
