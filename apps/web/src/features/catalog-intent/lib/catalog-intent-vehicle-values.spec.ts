import {
  FuelType,
  VehicleType,
  type PublicCatalogOffering,
  type PublicCatalogVariantPage,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { catalogIntentVehicleValues, latestYearOnSale } from './catalog-intent-vehicle-values';

function offering(overrides: Partial<PublicCatalogOffering>): PublicCatalogOffering {
  return {
    fuelTypes: [FuelType.Petrol],
    yearStart: 2020,
    yearEnd: null,
    isCurrent: true,
    ...overrides,
  };
}

describe('catalogIntentVehicleValues', () => {
  it('fills in the catalog names, the type and the fuel, for a year it was sold', () => {
    const page = {
      vehicleType: VehicleType.SUV,
      make: { name: 'Hyundai', slug: 'hyundai' },
      model: { name: 'Creta', slug: 'creta' },
      variant: { name: 'SX (O)', slug: 'sx-o' },
      offerings: [offering({ fuelTypes: [FuelType.Diesel], yearStart: 2020, yearEnd: 2023 })],
      calculatorSeed: { fuelType: FuelType.Diesel },
    } as unknown as PublicCatalogVariantPage;

    expect(catalogIntentVehicleValues(page, new Date('2026-09-23T00:00:00Z'))).toEqual({
      vehicleType: VehicleType.SUV,
      year: 2023,
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX (O)',
      fuelType: FuelType.Diesel,
    });
  });
});

describe('latestYearOnSale', () => {
  it('is this year for a variant still on sale', () => {
    expect(latestYearOnSale([offering({ yearStart: 2019, yearEnd: null })], 2026)).toBe(2026);
  });

  it('is the last year sold for a variant that has ended', () => {
    expect(
      latestYearOnSale([offering({ yearStart: 2017, yearEnd: 2022, isCurrent: false })], 2026),
    ).toBe(2022);
  });

  it('is the first year for one announced for a later year', () => {
    expect(latestYearOnSale([offering({ yearStart: 2027, yearEnd: null })], 2026)).toBe(2027);
  });

  it('reads only the newest offering, which the payload puts first', () => {
    expect(
      latestYearOnSale(
        [
          offering({ yearStart: 2023, yearEnd: null }),
          offering({ yearStart: 2015, yearEnd: 2019, isCurrent: false }),
        ],
        2026,
      ),
    ).toBe(2026);
  });

  it('is this year when nothing says otherwise', () => {
    expect(latestYearOnSale([], 2026)).toBe(2026);
    expect(latestYearOnSale([offering({ yearStart: null, yearEnd: null })], 2026)).toBe(2026);
  });
});
