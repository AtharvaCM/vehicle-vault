import {
  MaintenanceCategory,
  MaintenanceRecordStatus,
  TyrePosition,
  type Tyre,
  type TyreInspection,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';

import { tyreHistory } from './tyre-history';

const front: Tyre = {
  id: 'front',
  vehicleId: 'v',
  position: TyrePosition.Front,
  brand: 'MRF',
  model: 'Zapper',
  size: '100/90-17',
  dotWeek: null,
  dotYear: null,
  fittedDate: '2026-01-05T00:00:00.000Z',
  fittedOdometer: 1000,
  removedDate: null,
  removedOdometer: null,
  expectedLifeKm: null,
  notes: null,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
};
const rear: Tyre = { ...front, id: 'rear', position: TyrePosition.Rear };

function reading(tyreId: string, treadDepthMm: number): TyreInspection {
  return {
    id: `${tyreId}-r`,
    tyreId,
    vehicleId: 'v',
    inspectedAt: '2026-08-12T00:00:00.000Z',
    odometer: 9000,
    treadDepthMm,
    pressurePsi: null,
    notes: null,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
  };
}

describe('tyreHistory', () => {
  it('puts one walk-around on one line, and everything newest first', () => {
    const puncture = {
      id: 'p',
      vehicleId: 'v',
      category: MaintenanceCategory.Puncture,
      serviceDate: '2026-05-01T00:00:00.000Z',
      odometer: 6000,
      totalCost: 150,
      workshopName: 'Corner shop',
      status: MaintenanceRecordStatus.Confirmed,
    } as MaintenanceRecord;

    const items = tyreHistory({
      tyres: [front, rear],
      readings: [reading('front', 3.4), reading('rear', 1.9)],
      records: [puncture],
    });

    expect(items.map((item) => item.title)).toEqual([
      'Inspection · front 3.4 mm, rear 1.9 mm',
      'Puncture',
      'Fitted 2 tyres · MRF Zapper',
    ]);
    expect(items[1]).toMatchObject({ recordId: 'p' });
    expect(items[1]!.details).toEqual(['1 May 2026', '6,000 km', 'Corner shop', '₹150']);
  });

  it('names the position of a tyre fitted on its own', () => {
    const items = tyreHistory({
      tyres: [
        front,
        { ...rear, fittedDate: '2026-07-01T00:00:00.000Z', brand: 'CEAT', model: null },
      ],
      readings: [],
      records: [],
    });

    expect(items.map((item) => item.title)).toEqual([
      'Fitted rear · CEAT',
      'Fitted front · MRF Zapper',
    ]);
  });
});
