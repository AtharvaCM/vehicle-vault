/**
 * Specs for the ownership-cost estimator in `@vehicle-vault/shared`. The shared
 * package has no test runner of its own; the web app's Vitest resolves it from
 * source, so its specs live here, beside the calculator that uses it.
 */
import {
  ASSUMED_VALUE_KEPT_PER_YEAR,
  DEFAULT_ENERGY_PRICE_INR,
  DEFAULT_KM_PER_MONTH,
  DEFAULT_OWNERSHIP_YEARS,
  DEFAULT_SERVICE_COST_PER_VISIT_INR,
  FuelType,
  OWNERSHIP_COST_DEFAULTS_AS_OF,
  OWNERSHIP_COST_LIMITS,
  TYPICAL_EFFICIENCY,
  VehicleType,
  claimedEfficiency,
  estimateOwnershipCost,
  ownershipCostDefaults,
  ownershipCostEnergyUnits,
  type OwnershipCostEstimate,
  type OwnershipCostInput,
  type OwnershipCostResult,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

const EVERY_10K_OR_12_MONTHS = { km: 10_000, months: 12 };

/** A petrol car with every visitor input given, so nothing is defaulted. */
function petrolCar(overrides: Partial<OwnershipCostInput> = {}): OwnershipCostInput {
  return {
    fuelType: FuelType.Petrol,
    vehicleType: VehicleType.Car,
    claimed: { mileage: 20 },
    serviceInterval: EVERY_10K_OR_12_MONTHS,
    kmPerMonth: 1000,
    years: 5,
    efficiency: 20,
    energyPrice: 100,
    serviceCostPerVisit: 6000,
    // 12,000 km a year against the 10,000 km interval: 1.2 visits.
    servicesPerYear: 1.2,
    ...overrides,
  };
}

function electricCar(overrides: Partial<OwnershipCostInput> = {}): OwnershipCostInput {
  return {
    fuelType: FuelType.Electric,
    vehicleType: VehicleType.Car,
    claimed: { batteryKwh: 30, rangeKm: 300 },
    serviceInterval: EVERY_10K_OR_12_MONTHS,
    kmPerMonth: 1500,
    years: 4,
    efficiency: 12,
    energyPrice: 8,
    serviceCostPerVisit: 3000,
    servicesPerYear: 1.2,
    ...overrides,
  };
}

function expectEstimate(result: OwnershipCostResult): OwnershipCostEstimate {
  if (result.kind !== 'estimate') {
    throw new Error(`expected an estimate, got ${JSON.stringify(result.problems)}`);
  }
  return result;
}

/** Every number anywhere in the result, however deep. */
function numbersIn(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(numbersIn);
  return [];
}

describe('estimateOwnershipCost — liquid fuel', () => {
  it('works out fuel from km per month, km/L and the price per litre', () => {
    const estimate = expectEstimate(estimateOwnershipCost(petrolCar()));

    // 1,000 km ÷ 20 km/L = 50 L a month, at ₹100.
    expect(estimate.perMonth.energy).toBe(5000);
    expect(estimate.perYear.energy).toBe(60_000);
    expect(estimate.overYears.energy).toBe(300_000);
    expect(estimate.units).toEqual({ kind: 'liquid', efficiencyUnit: 'km/L', priceUnit: 'L' });
  });

  it('adds energy and service into each total', () => {
    const estimate = expectEstimate(estimateOwnershipCost(petrolCar()));

    // 12,000 km a year against a 10,000 km interval: 1.2 visits at ₹6,000.
    expect(estimate.serviceVisitsPerYear).toBeCloseTo(1.2);
    expect(estimate.perYear.service).toBeCloseTo(7200);
    expect(estimate.perMonth.service).toBeCloseTo(600);
    expect(estimate.overYears.service).toBeCloseTo(36_000);
    expect(estimate.perMonth.total).toBeCloseTo(5600);
    expect(estimate.perYear.total).toBeCloseTo(67_200);
    expect(estimate.overYears.total).toBeCloseTo(336_000);
  });

  it('treats CNG as km per kg and a price per kg', () => {
    const estimate = expectEstimate(
      estimateOwnershipCost(petrolCar({ fuelType: FuelType.CNG, efficiency: 25, energyPrice: 80 })),
    );

    expect(estimate.units).toEqual({ kind: 'liquid', efficiencyUnit: 'km/kg', priceUnit: 'kg' });
    // 1,000 km ÷ 25 km/kg = 40 kg at ₹80.
    expect(estimate.perMonth.energy).toBe(3200);
  });

  it.each([FuelType.Diesel, FuelType.Hybrid, FuelType.LPG, FuelType.Other])(
    'treats %s as a liquid fuel in km/L',
    (fuelType) => {
      expect(ownershipCostEnergyUnits(fuelType)).toEqual({
        kind: 'liquid',
        efficiencyUnit: 'km/L',
        priceUnit: 'L',
      });
    },
  );
});

describe('estimateOwnershipCost — electric', () => {
  it('works in kWh per 100 km and a price per kWh', () => {
    const estimate = expectEstimate(estimateOwnershipCost(electricCar()));

    expect(estimate.units).toEqual({
      kind: 'electric',
      efficiencyUnit: 'kWh/100 km',
      priceUnit: 'kWh',
    });
    // 1,500 km × 12 kWh/100 km = 180 kWh a month, at ₹8.
    expect(estimate.perMonth.energy).toBeCloseTo(1440);
    expect(estimate.perYear.energy).toBeCloseTo(17_280);
    expect(estimate.overYears.energy).toBeCloseTo(69_120);
  });

  it('defaults the efficiency to the battery over the claimed range', () => {
    const estimate = expectEstimate(estimateOwnershipCost(electricCar({ efficiency: undefined })));

    // 30 kWh over 300 km is 10 kWh per 100 km.
    expect(estimate.inputs.efficiency).toBe(10);
    expect(estimate.defaulted).toEqual(['efficiency']);
  });

  it('rounds a derived efficiency to one decimal', () => {
    expect(claimedEfficiency(FuelType.Electric, { batteryKwh: 30.2, rangeKm: 312 })).toBe(9.7);
  });

  it('ignores a claimed km/L on an EV', () => {
    expect(claimedEfficiency(FuelType.Electric, { mileage: 20 })).toBeNull();
  });

  it.each([
    [{ batteryKwh: 30, rangeKm: null }],
    [{ batteryKwh: null, rangeKm: 300 }],
    [{ batteryKwh: 0, rangeKm: 300 }],
    [{ batteryKwh: 30, rangeKm: 0 }],
    [{ batteryKwh: -30, rangeKm: 300 }],
    [{ batteryKwh: Number.NaN, rangeKm: 300 }],
    [{ batteryKwh: 30, rangeKm: Number.POSITIVE_INFINITY }],
  ])('has no claimed efficiency from %j', (claimed) => {
    expect(claimedEfficiency(FuelType.Electric, claimed)).toBeNull();
  });

  it('falls back to a typical EV figure when there is nothing to derive one from', () => {
    const estimate = expectEstimate(
      estimateOwnershipCost(
        electricCar({ efficiency: undefined, claimed: { batteryKwh: 30, rangeKm: null } }),
      ),
    );

    expect(estimate.inputs.efficiency).toBe(
      TYPICAL_EFFICIENCY[VehicleType.Car]?.[FuelType.Electric],
    );
    expect(estimate.efficiencySource).toBe('typical');
  });
});

describe('estimateOwnershipCost — service visits from the interval', () => {
  it('lets a visitor override the computed visits a year directly', () => {
    const estimate = expectEstimate(
      estimateOwnershipCost(petrolCar({ servicesPerYear: 3, serviceCostPerVisit: 1000 })),
    );

    expect(estimate.serviceVisitsPerYear).toBe(3);
    expect(estimate.perYear.service).toBe(3000);
    expect(estimate.defaulted).not.toContain('servicesPerYear');
  });

  it('defaults the visits a year from a time-dominant interval', () => {
    const estimate = expectEstimate(
      estimateOwnershipCost(
        petrolCar({ serviceInterval: { km: 50000, months: 6 }, servicesPerYear: undefined }),
      ),
    );

    // 12,000 typical km a year is 0.24 visits by distance; the 6-month limit wins.
    expect(estimate.serviceVisitsPerYear).toBe(2);
  });

  it('uses a distance-only interval', () => {
    const estimate = expectEstimate(
      estimateOwnershipCost(
        petrolCar({ serviceInterval: { km: 5000, months: null }, servicesPerYear: undefined }),
      ),
    );

    expect(estimate.serviceVisitsPerYear).toBeCloseTo(2.4);
    expect(estimate.defaulted).toContain('servicesPerYear');
  });

  it('uses a time-only interval', () => {
    const estimate = expectEstimate(
      estimateOwnershipCost(
        petrolCar({ serviceInterval: { km: null, months: 6 }, servicesPerYear: undefined }),
      ),
    );

    expect(estimate.serviceVisitsPerYear).toBe(2);
  });

  it('costs nothing for service when a visit is free', () => {
    const estimate = expectEstimate(estimateOwnershipCost(petrolCar({ serviceCostPerVisit: 0 })));

    expect(estimate.perYear.service).toBe(0);
    expect(estimate.perYear.total).toBe(estimate.perYear.energy);
  });

  it.each([null, { km: null, months: null }])(
    'cannot estimate without an interval (%j)',
    (serviceInterval) => {
      expect(estimateOwnershipCost(petrolCar({ serviceInterval }))).toEqual({
        kind: 'cannot-estimate',
        problems: [{ field: 'serviceInterval', problem: 'missing' }],
      });
    },
  );

  it.each([
    [{ km: 0, months: 12 }, 'too-small'],
    [{ km: -10_000, months: null }, 'too-small'],
    [{ km: 10_000, months: 0 }, 'too-small'],
    [{ km: 5_000_000, months: 12 }, 'too-large'],
    [{ km: null, months: 1000 }, 'too-large'],
    [{ km: Number.NaN, months: 12 }, 'not-a-number'],
  ] as const)('cannot estimate with the interval %j', (serviceInterval, problem) => {
    expect(estimateOwnershipCost(petrolCar({ serviceInterval }))).toEqual({
      kind: 'cannot-estimate',
      problems: [{ field: 'serviceInterval', problem }],
    });
  });
});

describe('estimateOwnershipCost — on-road price', () => {
  it('leaves ownership out when no price is given', () => {
    const estimate = expectEstimate(estimateOwnershipCost(petrolCar()));

    expect(estimate.inputs.onRoadPrice).toBeNull();
    expect(estimate.ownership).toBeNull();
  });

  it('treats a blank price as no price', () => {
    const estimate = expectEstimate(estimateOwnershipCost(petrolCar({ onRoadPrice: null })));

    expect(estimate.ownership).toBeNull();
    expect(estimate.defaulted).toEqual([]);
  });

  it('never puts the purchase into the running cost', () => {
    const without = expectEstimate(estimateOwnershipCost(petrolCar()));
    const withPrice = expectEstimate(estimateOwnershipCost(petrolCar({ onRoadPrice: 900_000 })));

    expect(withPrice.perMonth).toEqual(without.perMonth);
    expect(withPrice.perYear).toEqual(without.perYear);
    expect(withPrice.overYears).toEqual(without.overYears);
    expect(Object.keys(withPrice.perMonth).sort()).toEqual(['energy', 'service', 'total']);
  });

  it('works out ownership as the price, less an assumed resale, plus running it', () => {
    const estimate = expectEstimate(estimateOwnershipCost(petrolCar({ onRoadPrice: 900_000 })));
    const resale = 900_000 * ASSUMED_VALUE_KEPT_PER_YEAR ** 5;

    expect(estimate.ownership?.onRoadPrice).toBe(900_000);
    expect(estimate.ownership?.resaleValue).toBeCloseTo(resale);
    // About 44% kept after five years.
    expect(resale / 900_000).toBeCloseTo(0.44, 2);
    expect(estimate.ownership?.running).toBeCloseTo(336_000);
    expect(estimate.ownership?.total).toBeCloseTo(900_000 - resale + 336_000);
    expect(estimate.ownership?.perMonth).toBeCloseTo((900_000 - resale + 336_000) / 60);
  });

  it.each([
    [0, 'too-small'],
    [-500_000, 'too-small'],
    [1e12, 'too-large'],
    [Number.NaN, 'not-a-number'],
  ] as const)('cannot estimate with an on-road price of %s', (onRoadPrice, problem) => {
    expect(estimateOwnershipCost(petrolCar({ onRoadPrice }))).toEqual({
      kind: 'cannot-estimate',
      problems: [{ field: 'onRoadPrice', problem }],
    });
  });
});

describe('estimateOwnershipCost — defaulted inputs', () => {
  it('names nothing as defaulted when every input is given', () => {
    expect(expectEstimate(estimateOwnershipCost(petrolCar())).defaulted).toEqual([]);
  });

  it('fills every input a visitor leaves alone and names each one', () => {
    const estimate = expectEstimate(
      estimateOwnershipCost({
        fuelType: FuelType.Petrol,
        vehicleType: VehicleType.Car,
        claimed: { mileage: 18.5 },
        serviceInterval: EVERY_10K_OR_12_MONTHS,
      }),
    );

    expect(estimate.defaulted).toEqual([
      'kmPerMonth',
      'years',
      'efficiency',
      'energyPrice',
      'serviceCostPerVisit',
      'servicesPerYear',
    ]);
    expect(estimate.inputs).toEqual({
      kmPerMonth: DEFAULT_KM_PER_MONTH[VehicleType.Car],
      years: DEFAULT_OWNERSHIP_YEARS,
      efficiency: 18.5,
      energyPrice: DEFAULT_ENERGY_PRICE_INR[FuelType.Petrol],
      serviceCostPerVisit: DEFAULT_SERVICE_COST_PER_VISIT_INR[VehicleType.Car],
      // 12,000 km a year (the car default) against the 10,000 km interval.
      servicesPerYear: 1.2,
      onRoadPrice: null,
      serviceInterval: EVERY_10K_OR_12_MONTHS,
    });
  });

  it('names only the inputs that were left alone', () => {
    const estimate = expectEstimate(
      estimateOwnershipCost(petrolCar({ energyPrice: undefined, years: undefined })),
    );

    expect(estimate.defaulted).toEqual(['years', 'energyPrice']);
  });

  it('uses the price for the fuel and the service cost for the vehicle type', () => {
    const bike = ownershipCostDefaults({
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Motorcycle,
      claimed: { mileage: 45 },
    });
    const dieselSuv = ownershipCostDefaults({
      fuelType: FuelType.Diesel,
      vehicleType: VehicleType.SUV,
    });

    expect(bike).toEqual({
      kmPerMonth: DEFAULT_KM_PER_MONTH[VehicleType.Motorcycle],
      years: DEFAULT_OWNERSHIP_YEARS,
      efficiency: 45,
      energyPrice: DEFAULT_ENERGY_PRICE_INR[FuelType.Petrol],
      serviceCostPerVisit: DEFAULT_SERVICE_COST_PER_VISIT_INR[VehicleType.Motorcycle],
      // No serviceInterval was given, so there's nothing to derive a count from.
      servicesPerYear: null,
    });
    expect(dieselSuv.energyPrice).toBe(DEFAULT_ENERGY_PRICE_INR[FuelType.Diesel]);
    expect(dieselSuv.serviceCostPerVisit).toBe(DEFAULT_SERVICE_COST_PER_VISIT_INR[VehicleType.SUV]);
    // No claimed figure: a typical one for a diesel SUV.
    expect(dieselSuv.efficiency).toBe(TYPICAL_EFFICIENCY[VehicleType.SUV]?.[FuelType.Diesel]);
  });

  it('has a default price for every fuel but other', () => {
    for (const fuelType of Object.values(FuelType)) {
      const price = DEFAULT_ENERGY_PRICE_INR[fuelType];
      if (fuelType === FuelType.Other) expect(price).toBeUndefined();
      else expect(price).toBeGreaterThan(0);
    }
  });

  it('dates its defaults', () => {
    expect(OWNERSHIP_COST_DEFAULTS_AS_OF).toMatch(/^\d{4}-\d{2}$/);
  });

  it('starts a liquid fuel with no claimed mileage from a typical figure, and says so', () => {
    const estimate = expectEstimate(
      estimateOwnershipCost(petrolCar({ efficiency: undefined, claimed: { mileage: null } })),
    );

    expect(estimate.inputs.efficiency).toBe(15);
    expect(estimate.efficiencySource).toBe('typical');
    expect(estimate.defaulted).toEqual(['efficiency']);
  });

  it('says a claimed figure is claimed, and a given one is neither', () => {
    expect(
      expectEstimate(estimateOwnershipCost(petrolCar({ efficiency: undefined }))).efficiencySource,
    ).toBe('claimed');
    expect(expectEstimate(estimateOwnershipCost(petrolCar())).efficiencySource).toBeNull();
  });

  it('cannot estimate a fuel with no typical figure and no claim', () => {
    expect(
      estimateOwnershipCost(
        petrolCar({ fuelType: FuelType.Other, efficiency: undefined, claimed: { mileage: null } }),
      ),
    ).toEqual({ kind: 'cannot-estimate', problems: [{ field: 'efficiency', problem: 'missing' }] });
  });

  it.each([0, -12, Number.NaN])('does not take a claimed mileage of %s', (mileage) => {
    expect(claimedEfficiency(FuelType.Petrol, { mileage })).toBeNull();
  });

  it('cannot estimate where there is no default to fall back on', () => {
    const result = estimateOwnershipCost({
      fuelType: FuelType.Other,
      vehicleType: VehicleType.Truck,
      claimed: { mileage: 5 },
      serviceInterval: EVERY_10K_OR_12_MONTHS,
    });

    expect(result).toEqual({
      kind: 'cannot-estimate',
      problems: [
        { field: 'energyPrice', problem: 'missing' },
        { field: 'serviceCostPerVisit', problem: 'missing' },
      ],
    });
  });
});

describe('estimateOwnershipCost — input it cannot estimate from', () => {
  const cases: Array<[string, Partial<OwnershipCostInput>, string, string]> = [
    ['zero km a month', { kmPerMonth: 0 }, 'kmPerMonth', 'too-small'],
    ['negative km a month', { kmPerMonth: -500 }, 'kmPerMonth', 'too-small'],
    ['absurd km a month', { kmPerMonth: 1_000_000 }, 'kmPerMonth', 'too-large'],
    ['blank km a month', { kmPerMonth: null }, 'kmPerMonth', 'missing'],
    ['NaN km a month', { kmPerMonth: Number.NaN }, 'kmPerMonth', 'not-a-number'],
    ['infinite km a month', { kmPerMonth: Infinity }, 'kmPerMonth', 'not-a-number'],
    ['zero years', { years: 0 }, 'years', 'too-small'],
    ['negative years', { years: -2 }, 'years', 'too-small'],
    ['a hundred years', { years: 100 }, 'years', 'too-large'],
    ['blank years', { years: null }, 'years', 'missing'],
    ['zero mileage', { efficiency: 0 }, 'efficiency', 'too-small'],
    ['negative mileage', { efficiency: -15 }, 'efficiency', 'too-small'],
    ['absurd mileage', { efficiency: 5000 }, 'efficiency', 'too-large'],
    ['blank mileage', { efficiency: null }, 'efficiency', 'missing'],
    ['NaN mileage', { efficiency: Number.NaN }, 'efficiency', 'not-a-number'],
    ['negative price', { energyPrice: -1 }, 'energyPrice', 'too-small'],
    ['absurd price', { energyPrice: 50_000 }, 'energyPrice', 'too-large'],
    ['blank price', { energyPrice: null }, 'energyPrice', 'missing'],
    ['negative service cost', { serviceCostPerVisit: -100 }, 'serviceCostPerVisit', 'too-small'],
    ['absurd service cost', { serviceCostPerVisit: 1e9 }, 'serviceCostPerVisit', 'too-large'],
    ['blank service cost', { serviceCostPerVisit: null }, 'serviceCostPerVisit', 'missing'],
  ];

  it.each(cases)('refuses %s', (_label, overrides, field, problem) => {
    const result = estimateOwnershipCost(petrolCar(overrides));

    expect(result).toEqual({ kind: 'cannot-estimate', problems: [{ field, problem }] });
  });

  it.each([
    ['zero', 0, 'too-small'],
    ['absurd', 500, 'too-large'],
  ] as const)('refuses %s kWh per 100 km on an EV', (_label, efficiency, problem) => {
    expect(estimateOwnershipCost(electricCar({ efficiency }))).toEqual({
      kind: 'cannot-estimate',
      problems: [{ field: 'efficiency', problem }],
    });
  });

  it('accepts an EV figure that would be absurd as km/L, and the reverse', () => {
    expect(estimateOwnershipCost(electricCar({ efficiency: 90 })).kind).toBe('estimate');
    expect(estimateOwnershipCost(petrolCar({ efficiency: 150 })).kind).toBe('estimate');
    expect(estimateOwnershipCost(electricCar({ efficiency: 150 })).kind).toBe('cannot-estimate');
  });

  it('lists every input at fault, in input order', () => {
    const result = estimateOwnershipCost(
      petrolCar({ kmPerMonth: -1, energyPrice: Number.NaN, onRoadPrice: 0, serviceInterval: null }),
    );

    expect(result).toEqual({
      kind: 'cannot-estimate',
      problems: [
        { field: 'kmPerMonth', problem: 'too-small' },
        { field: 'energyPrice', problem: 'not-a-number' },
        { field: 'onRoadPrice', problem: 'too-small' },
        { field: 'serviceInterval', problem: 'missing' },
      ],
    });
  });

  it('accepts the limits themselves', () => {
    const limits = OWNERSHIP_COST_LIMITS;
    const low = estimateOwnershipCost(
      petrolCar({
        kmPerMonth: limits.kmPerMonth.min,
        years: limits.years.min,
        efficiency: limits.liquidEfficiency.min,
        energyPrice: limits.energyPrice.min,
        serviceCostPerVisit: limits.serviceCostPerVisit.min,
        onRoadPrice: limits.onRoadPrice.min,
        serviceInterval: {
          km: limits.serviceIntervalKm.min,
          months: limits.serviceIntervalMonths.min,
        },
      }),
    );
    const high = estimateOwnershipCost(
      petrolCar({
        kmPerMonth: limits.kmPerMonth.max,
        years: limits.years.max,
        efficiency: limits.liquidEfficiency.max,
        energyPrice: limits.energyPrice.max,
        serviceCostPerVisit: limits.serviceCostPerVisit.max,
        onRoadPrice: limits.onRoadPrice.max,
        serviceInterval: {
          km: limits.serviceIntervalKm.max,
          months: limits.serviceIntervalMonths.max,
        },
      }),
    );

    expect(low.kind).toBe('estimate');
    expect(high.kind).toBe('estimate');
  });

  it('never throws and never puts NaN or Infinity in a result', () => {
    const awkward = [
      undefined,
      null,
      0,
      -1,
      0.0001,
      1,
      7.5,
      1e6,
      1e308,
      Number.NaN,
      Infinity,
      -Infinity,
    ];
    const fuels = [FuelType.Petrol, FuelType.Electric, FuelType.CNG, FuelType.Other];

    for (const fuelType of fuels) {
      for (const value of awkward) {
        const inputs: OwnershipCostInput[] = [
          petrolCar({ fuelType, kmPerMonth: value }),
          petrolCar({ fuelType, years: value }),
          petrolCar({ fuelType, efficiency: value }),
          petrolCar({ fuelType, energyPrice: value }),
          petrolCar({ fuelType, serviceCostPerVisit: value }),
          petrolCar({ fuelType, onRoadPrice: value }),
          petrolCar({ fuelType, serviceInterval: { km: value ?? null, months: null } }),
          petrolCar({ fuelType, serviceInterval: { km: null, months: value ?? null } }),
          {
            fuelType,
            vehicleType: VehicleType.Motorcycle,
            serviceInterval: EVERY_10K_OR_12_MONTHS,
            claimed: { mileage: value, batteryKwh: value, rangeKm: value },
          },
        ];

        for (const input of inputs) {
          let result: OwnershipCostResult | undefined;
          expect(() => {
            result = estimateOwnershipCost(input);
          }).not.toThrow();
          for (const n of numbersIn(result)) {
            expect(Number.isFinite(n), `${n} in ${JSON.stringify(result)}`).toBe(true);
          }
          if (result?.kind === 'cannot-estimate') {
            expect(result.problems.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
