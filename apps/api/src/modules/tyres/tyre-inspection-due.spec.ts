import { TyrePosition, VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { tyreInspectionDue, type InspectionDueTyre } from './tyre-inspection-due';

const NOW = new Date('2026-11-21T00:00:00.000Z');

function tyre(overrides: Partial<InspectionDueTyre> = {}): InspectionDueTyre {
  return {
    position: TyrePosition.FrontLeft,
    fittedDate: new Date('2026-02-18T00:00:00.000Z'),
    fittedOdometer: 0,
    expectedLifeKm: null,
    inspections: [],
    ...overrides,
  };
}

function reading(at: string, odometer: number, treadDepthMm: number | null) {
  return { inspectedAt: new Date(at), odometer, treadDepthMm };
}

const set = (overrides: Partial<InspectionDueTyre> = {}) =>
  [
    TyrePosition.FrontLeft,
    TyrePosition.FrontRight,
    TyrePosition.RearLeft,
    TyrePosition.RearRight,
  ].map((position) => tyre({ position, ...overrides }));

describe('tyreInspectionDue', () => {
  it('leaves a new car on its original tyres alone', () => {
    // Fitted at delivery nine months ago, never gauged, 10,803 km on: new
    // tread is about 8 mm and typical wear has taken it to about 6.5.
    expect(tyreInspectionDue(set(), 10_803, VehicleType.Car, NOW)).toBeNull();
  });

  it('asks a never-measured set for its first look a year after fitting', () => {
    const due = tyreInspectionDue(
      set({ fittedDate: new Date('2025-11-01T00:00:00.000Z') }),
      12_000,
      VehicleType.Car,
      NOW,
    );

    expect(due).toEqual({
      trigger: 'time',
      measured: false,
      kmSinceLastCheck: 12_000,
      daysSinceLastCheck: 385,
      projectedTreadMm: 6.5,
    });
  });

  it('asks a never-measured set once typical wear brings it to a millimetre above the warning', () => {
    // 8 mm less 21,000 km at 7,000 km/mm is 5 mm.
    const due = tyreInspectionDue(set(), 21_000, VehicleType.Car, NOW);

    expect(due).toMatchObject({ trigger: 'wear', measured: false, projectedTreadMm: 5 });
  });

  it('wears a two-wheeler faster from a shallower new tread', () => {
    // 6 mm less 5,000 km at 5,000 km/mm is 5 mm.
    const bike = [tyre({ position: TyrePosition.Rear })];

    expect(tyreInspectionDue(bike, 4_900, VehicleType.Motorcycle, NOW)).toBeNull();
    expect(tyreInspectionDue(bike, 5_000, VehicleType.Motorcycle, NOW)).toMatchObject({
      trigger: 'wear',
      projectedTreadMm: 5,
    });
  });

  it("follows the tyre's own wear rate once it has two readings", () => {
    // 7 mm to 6 mm over 3,000 km: a hard-wearing driver. 6 mm reaches the 5 mm
    // checkpoint 3,000 km after the newest reading, not 7,000.
    const worn = tyre({
      inspections: [
        reading('2026-08-01T00:00:00.000Z', 8_000, 6),
        reading('2026-05-01T00:00:00.000Z', 5_000, 7),
      ],
    });

    expect(tyreInspectionDue([worn], 10_900, VehicleType.Car, NOW)).toBeNull();
    expect(tyreInspectionDue([worn], 11_000, VehicleType.Car, NOW)).toMatchObject({
      trigger: 'wear',
      measured: true,
      kmSinceLastCheck: 3_000,
      projectedTreadMm: 5,
    });
  });

  it('moves the next request on after each reading rather than repeating it', () => {
    // Measured at 4.8 mm yesterday: past the 5 mm checkpoint already, so the
    // next one worth asking about is the 4 mm warning.
    const fresh = tyre({ inspections: [reading('2026-11-20T00:00:00.000Z', 30_000, 4.8)] });

    expect(tyreInspectionDue([fresh], 30_000, VehicleType.Car, NOW)).toBeNull();
    expect(tyreInspectionDue([fresh], 35_600, VehicleType.Car, NOW)).toMatchObject({
      trigger: 'wear',
      projectedTreadMm: 4,
    });
  });

  it('uses the expected life an owner entered before falling back to the typical rate', () => {
    // 30,000 km from 8 mm to 3 mm is 6,000 km/mm: 5 mm at 18,000 km.
    const rated = set({ expectedLifeKm: 30_000 });

    expect(tyreInspectionDue(rated, 17_900, VehicleType.Car, NOW)).toBeNull();
    expect(tyreInspectionDue(rated, 18_000, VehicleType.Car, NOW)).toMatchObject({
      trigger: 'wear',
    });
  });

  it('counts a pressure-only look for the yearly check, but not as a tread reading', () => {
    const looked = tyre({
      fittedDate: new Date('2025-06-01T00:00:00.000Z'),
      inspections: [reading('2026-10-01T00:00:00.000Z', 9_000, null)],
    });

    expect(tyreInspectionDue([looked], 10_000, VehicleType.Car, NOW)).toBeNull();
  });

  it('leaves the spare out, which covers none of the mileage', () => {
    const spare = tyre({
      position: TyrePosition.Spare,
      fittedDate: new Date('2020-01-01T00:00:00.000Z'),
    });

    expect(tyreInspectionDue([spare], 60_000, VehicleType.Car, NOW)).toBeNull();
  });

  it('speaks for the vehicle through its most worn corner', () => {
    const due = tyreInspectionDue(
      [
        tyre({ inspections: [reading('2026-06-01T00:00:00.000Z', 20_000, 5.5)] }),
        tyre({
          position: TyrePosition.RearRight,
          inspections: [reading('2026-06-01T00:00:00.000Z', 20_000, 4.5)],
        }),
      ],
      24_000,
      VehicleType.Car,
      NOW,
    );

    expect(due).toMatchObject({ trigger: 'wear', projectedTreadMm: 4 });
  });

  it('leaves a tyre already below the replacement depth to the worn-tyre alert', () => {
    const bald = tyre({ inspections: [reading('2026-11-01T00:00:00.000Z', 40_000, 2.5)] });

    expect(tyreInspectionDue([bald], 45_000, VehicleType.Car, NOW)).toBeNull();
  });
});
