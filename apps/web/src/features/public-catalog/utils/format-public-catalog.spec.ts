import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import {
  describeInterval,
  describeOffering,
  describeScheduleBasis,
  formatYearSpan,
} from './format-public-catalog';

describe('describeScheduleBasis', () => {
  it("names a schedule with the variant's own intervals as the variant's", () => {
    expect(
      describeScheduleBasis({
        basis: 'variant',
        fuelType: FuelType.Petrol,
        vehicleType: VehicleType.Car,
        items: [],
      }),
    ).toBe('This variant’s schedule');
  });

  it.each([
    [FuelType.Petrol, VehicleType.Car, 'Typical schedule for a petrol car'],
    [FuelType.Electric, VehicleType.SUV, 'Typical schedule for an electric SUV'],
    [FuelType.CNG, VehicleType.Car, 'Typical schedule for a CNG car'],
    [FuelType.LPG, VehicleType.Car, 'Typical schedule for an LPG car'],
    [FuelType.Other, VehicleType.SUV, 'Typical schedule for an SUV'],
    [FuelType.Petrol, VehicleType.Motorcycle, 'Typical schedule for a petrol motorcycle'],
    [FuelType.Other, VehicleType.Van, 'Typical schedule for a van'],
  ])('names a default schedule by fuel %s and type %s', (fuelType, vehicleType, expected) => {
    expect(describeScheduleBasis({ basis: 'typical', fuelType, vehicleType, items: [] })).toBe(
      expected,
    );
  });
});

describe('describeInterval', () => {
  it('gives both limits with whichever-first when both exist', () => {
    expect(describeInterval({ km: 10000, months: 12 })).toBe(
      'Every 10,000 km or 12 months, whichever comes first',
    );
  });

  it('gives a distance-only or time-only interval on its own', () => {
    expect(describeInterval({ km: 500, months: null })).toBe('Every 500 km');
    expect(describeInterval({ km: null, months: 1 })).toBe('Every 1 month');
  });

  it('falls back when neither limit exists', () => {
    expect(describeInterval({ km: null, months: null })).toBe('As needed');
  });
});

describe('formatYearSpan and describeOffering', () => {
  it('reads a current offering as running to the present', () => {
    expect(formatYearSpan({ yearStart: 2023, yearEnd: null, isCurrent: true })).toBe(
      '2023 – present',
    );
  });

  it('reads an ended offering as a closed span, or one year when it started and ended together', () => {
    expect(formatYearSpan({ yearStart: 2020, yearEnd: 2023, isCurrent: false })).toBe(
      '2020 – 2023',
    );
    expect(formatYearSpan({ yearStart: 2021, yearEnd: 2021, isCurrent: false })).toBe('2021');
  });

  it('leaves the years out when there are none', () => {
    expect(
      describeOffering({
        fuelTypes: [FuelType.Petrol, FuelType.CNG],
        yearStart: null,
        yearEnd: null,
        isCurrent: false,
      }),
    ).toBe('Petrol, CNG');
  });
});
