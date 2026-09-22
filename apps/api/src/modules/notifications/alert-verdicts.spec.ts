import { ServiceBaselineStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { distanceIntervals, isAlertedFromMeasurements } from './alert-verdicts';

/**
 * The engine's own spec drives these verdicts end to end. What is left here is
 * what the engine used to get from its query and the dashboard cannot: the
 * dashboard's records arrive by service date, not by odometer.
 */
describe('distanceIntervals', () => {
  const intervals = {
    engine_oil: { km: 7500, months: 6, source: 'default' as const },
    brake_pads: { km: 30000, months: 24, source: 'default' as const },
    coolant: { km: null, months: 24, source: 'default' as const },
  };

  it('measures from the highest confirmed odometer, whatever order the rows arrive in', () => {
    const result = distanceIntervals({
      vehicle: { odometer: 42000 },
      intervals,
      confirmedRecords: [
        { category: 'engine_oil', odometer: 30000 },
        { category: 'engine_oil', odometer: 38000 },
        { category: 'engine_oil', odometer: 34000 },
      ],
      baselines: [],
    });

    expect(result.find((entry) => entry.category === 'engine_oil')?.lastDone).toEqual({
      kind: 'measured',
      odometer: 38000,
    });
  });

  it('times only the categories with a distance interval', () => {
    const result = distanceIntervals({
      vehicle: { odometer: 42000 },
      intervals,
      confirmedRecords: [],
      baselines: [
        { category: 'brake_pads', status: ServiceBaselineStatus.unknown, lastDoneOdometer: null },
      ],
    });

    expect(result).toEqual([
      { category: 'engine_oil', intervalKm: 7500, lastDone: { kind: 'measured', odometer: 42000 } },
      { category: 'brake_pads', intervalKm: 30000, lastDone: { kind: 'declared-unknown' } },
    ]);
  });
});

describe('isAlertedFromMeasurements', () => {
  it('picks out the tyre walk-around, and only it', () => {
    expect(isAlertedFromMeasurements({ notes: 'Measure tread.\n[catalog:tyre_inspection]' })).toBe(
      true,
    );
    expect(isAlertedFromMeasurements({ notes: '[catalog:tyre_rotation]' })).toBe(false);
    expect(isAlertedFromMeasurements({ notes: null })).toBe(false);
    expect(isAlertedFromMeasurements({})).toBe(false);
  });
});
