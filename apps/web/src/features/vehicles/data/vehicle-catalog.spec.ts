import { VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import {
  getCatalogMakes,
  getCatalogModels,
  getCatalogVariants,
  supportsVehicleCatalog,
} from './vehicle-catalog';

describe('vehicle catalog', () => {
  it('supports searchable makes for common vehicle types', () => {
    expect(supportsVehicleCatalog(VehicleType.Car)).toBe(true);
    expect(getCatalogMakes(VehicleType.Car)).toContain('Hyundai');
    expect(getCatalogMakes(VehicleType.Motorcycle)).toContain('Royal Enfield');
  });

  it('returns models and variants scoped by vehicle type and make', () => {
    expect(getCatalogModels(VehicleType.SUV, 'Hyundai')).toContain('Creta');
    expect(getCatalogModels(VehicleType.Car, 'Hyundai')).not.toContain('Creta');
    expect(getCatalogVariants(VehicleType.SUV, 'Hyundai', 'Creta')).toContain('SX (O)');
  });

  it('returns empty arrays for unsupported combinations', () => {
    expect(getCatalogModels(VehicleType.Truck, 'Tata')).toEqual([]);
    expect(getCatalogVariants(VehicleType.Car, 'Honda', 'Unknown')).toEqual([]);
  });
});
