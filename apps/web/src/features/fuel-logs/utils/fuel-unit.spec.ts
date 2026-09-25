import { FuelType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { fuelNoun, fuelQuantityUnit, supportsFullTank } from './fuel-unit';

describe('fuelQuantityUnit', () => {
  it.each([
    [FuelType.Petrol, 'L'],
    [FuelType.Diesel, 'L'],
    [FuelType.Hybrid, 'L'],
    [FuelType.LPG, 'L'],
    [FuelType.Other, 'L'],
    [FuelType.CNG, 'kg'],
    [FuelType.Electric, 'kWh'],
  ] as const)('is %s for %s', (fuelType, unit) => {
    expect(fuelQuantityUnit(fuelType)).toBe(unit);
  });

  it('falls back to litres when the fuel type is not known', () => {
    expect(fuelQuantityUnit(null)).toBe('L');
    expect(fuelQuantityUnit(undefined)).toBe('L');
  });
});

describe('fuelNoun', () => {
  it('is Charge only for an electric vehicle', () => {
    expect(fuelNoun(FuelType.Electric)).toBe('Charge');
    expect(fuelNoun(FuelType.Petrol)).toBe('Fuel');
    expect(fuelNoun(FuelType.CNG)).toBe('Fuel');
    expect(fuelNoun(undefined)).toBe('Fuel');
  });
});

describe('supportsFullTank', () => {
  it('is false only for an electric vehicle: everything else has a tank to fill', () => {
    expect(supportsFullTank(FuelType.Electric)).toBe(false);
    expect(supportsFullTank(FuelType.Petrol)).toBe(true);
    expect(supportsFullTank(FuelType.Diesel)).toBe(true);
    expect(supportsFullTank(FuelType.CNG)).toBe(true);
    expect(supportsFullTank(FuelType.LPG)).toBe(true);
    expect(supportsFullTank(undefined)).toBe(true);
  });
});
