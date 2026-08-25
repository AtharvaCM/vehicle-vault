import {
  FuelType,
  MaintenanceCategory,
  MaintenanceRecordStatus,
  VehicleType,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';

import type { Vehicle } from '../types/vehicle';
import { getTyreInsights } from './get-tyre-status';

const NOW = new Date('2026-08-25T00:00:00.000Z');

/** A brand-new Virtus GT: bought new, 6,908 km, no tyre work logged. */
const newVehicle: Vehicle = {
  id: 'vehicle-1',
  registrationNumber: 'MH12AB1234',
  make: 'Volkswagen',
  model: 'Virtus',
  variant: 'GT Plus',
  year: 2026,
  fuelType: FuelType.Petrol,
  vehicleType: VehicleType.Car,
  odometer: 6908,
  purchaseDate: '2026-03-01T00:00:00.000Z',
  purchaseOdometer: 0,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

function makeRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'record-1',
    vehicleId: newVehicle.id,
    category: MaintenanceCategory.TyreRotation,
    serviceDate: '2026-06-01T00:00:00.000Z',
    odometer: 5000,
    totalCost: 800,
    status: MaintenanceRecordStatus.Confirmed,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  } as MaintenanceRecord;
}

describe('getTyreInsights', () => {
  it('does not claim a verdict for a new vehicle with no tyre history', () => {
    const { rotation, alignment } = getTyreInsights({
      vehicle: newVehicle,
      records: [],
      now: NOW,
    });

    // The reported bug: 6,908 km on a new car was rendered as OVERDUE alignment.
    expect(alignment.status).not.toBe('overdue');
    expect(alignment.origin).toBe('new');
    expect(alignment.kmSince).toBe(6908);

    // Genuinely known history, so a verdict is legitimate — and 6,908 of 10,000
    // is not yet in the due band.
    expect(rotation.status).toBe('healthy');
    expect(rotation.kmRemaining).toBe(3092);
    expect(rotation.lastRecord).toBeNull();
  });

  it('reports unknown for a used vehicle whose prior service history is invisible', () => {
    const usedVehicle: Vehicle = {
      ...newVehicle,
      odometer: 62_000,
      purchaseOdometer: 60_000,
    };

    const { rotation } = getTyreInsights({ vehicle: usedVehicle, records: [], now: NOW });

    expect(rotation.status).toBe('unknown');
    expect(rotation.origin).toBe('purchase');
    // Still useful: we know how far it has run since they bought it.
    expect(rotation.kmSince).toBe(2000);
  });

  it('reports unknown when there is no record and no purchase odometer', () => {
    const vehicle: Vehicle = { ...newVehicle, purchaseOdometer: null, purchaseDate: null };

    const { rotation } = getTyreInsights({ vehicle, records: [], now: NOW });

    expect(rotation.status).toBe('unknown');
    expect(rotation.origin).toBe('none');
    expect(rotation.kmSince).toBeNull();
  });

  it('clamps at zero when a record odometer exceeds the vehicle reading', () => {
    const records = [makeRecord({ odometer: 15_000 })];

    const { rotation } = getTyreInsights({ vehicle: newVehicle, records, now: NOW });

    expect(rotation.kmSince).toBe(0);
    expect(rotation.status).not.toBe('overdue');
  });

  it('ignores records left at odometer 0 when choosing a baseline', () => {
    const records = [makeRecord({ id: 'blank', odometer: 0 })];

    const { rotation } = getTyreInsights({ vehicle: newVehicle, records, now: NOW });

    expect(rotation.lastRecord).toBeNull();
    expect(rotation.origin).toBe('new');
  });

  it('ignores draft records so an unconfirmed scan cannot reset the clock', () => {
    const records = [
      makeRecord({ odometer: 6000, status: MaintenanceRecordStatus.Draft }),
    ];

    const { rotation, records: history } = getTyreInsights({
      vehicle: newVehicle,
      records,
      now: NOW,
    });

    expect(rotation.lastRecord).toBeNull();
    expect(history).toHaveLength(0);
  });

  it('treats exactly at the interval as overdue, and one km short as due', () => {
    const atInterval = getTyreInsights({
      vehicle: { ...newVehicle, odometer: 10_000 },
      records: [],
      now: NOW,
    });
    expect(atInterval.rotation.kmSince).toBe(10_000);
    expect(atInterval.rotation.status).toBe('overdue');

    const justUnder = getTyreInsights({
      vehicle: { ...newVehicle, odometer: 9_999 },
      records: [],
      now: NOW,
    });
    expect(justUnder.rotation.status).toBe('due');
  });

  it('flags a low-mileage vehicle that has aged past the interval', () => {
    const garageQueen: Vehicle = {
      ...newVehicle,
      odometer: 2500,
      purchaseDate: '2024-01-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const { rotation } = getTyreInsights({ vehicle: garageQueen, records: [], now: NOW });

    // Barely driven, so distance alone would report healthy forever.
    expect(rotation.kmSince).toBe(2500);
    expect(rotation.status).toBe('overdue');
    expect(rotation.monthsSince).toBeGreaterThan(12);
  });

  it('picks the highest odometer, not the newest service date', () => {
    const records = [
      // Logged later but back-dated to an earlier, lower-odometer service.
      makeRecord({ id: 'backdated', serviceDate: '2026-07-01T00:00:00.000Z', odometer: 1000 }),
      makeRecord({ id: 'real', serviceDate: '2026-06-01T00:00:00.000Z', odometer: 6000 }),
    ];

    const { rotation } = getTyreInsights({ vehicle: newVehicle, records, now: NOW });

    expect(rotation.lastRecord?.id).toBe('real');
    expect(rotation.kmSince).toBe(908);
  });

  it("prefers the workshop's stated next-due over the default interval", () => {
    const records = [makeRecord({ odometer: 5000, nextDueOdometer: 23_000 })];

    const { rotation } = getTyreInsights({ vehicle: newVehicle, records, now: NOW });

    expect(rotation.usesRecordNextDue).toBe(true);
    expect(rotation.intervalKm).toBe(18_000);
    expect(rotation.status).toBe('healthy');
  });

  it('ignores a next-due that is not ahead of the service it belongs to', () => {
    const records = [makeRecord({ odometer: 5000, nextDueOdometer: 4000 })];

    const { rotation } = getTyreInsights({ vehicle: newVehicle, records, now: NOW });

    expect(rotation.usesRecordNextDue).toBe(false);
    expect(rotation.intervalKm).toBe(10_000);
  });

  it('surfaces the latest tyre replacement and includes punctures in history', () => {
    const records = [
      makeRecord({
        id: 'puncture',
        category: MaintenanceCategory.Puncture,
        serviceDate: '2026-07-10T00:00:00.000Z',
        odometer: 6500,
      }),
      makeRecord({
        id: 'old-replacement',
        category: MaintenanceCategory.TyreReplacement,
        serviceDate: '2026-04-01T00:00:00.000Z',
        odometer: 2000,
      }),
      makeRecord({
        id: 'new-replacement',
        category: MaintenanceCategory.TyreReplacement,
        serviceDate: '2026-05-01T00:00:00.000Z',
        odometer: 4000,
      }),
    ];

    const { lastReplacement, records: history } = getTyreInsights({
      vehicle: newVehicle,
      records,
      now: NOW,
    });

    expect(lastReplacement?.id).toBe('new-replacement');
    expect(history.map((record) => record.id)).toEqual([
      'puncture',
      'new-replacement',
      'old-replacement',
    ]);
  });

  it('returns an unknown verdict when the vehicle has not loaded', () => {
    const { rotation, alignment } = getTyreInsights({ vehicle: null, records: [], now: NOW });

    expect(rotation.status).toBe('unknown');
    expect(alignment.status).toBe('unknown');
    expect(rotation.kmSince).toBeNull();
  });
});
