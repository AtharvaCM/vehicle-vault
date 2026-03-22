import { VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { supportsVehicleCatalog } from './vehicle-catalog';

describe('vehicle catalog', () => {
  it('supports searchable catalog lookups for common vehicle types', () => {
    expect(supportsVehicleCatalog(VehicleType.Car)).toBe(true);
    expect(supportsVehicleCatalog(VehicleType.Motorcycle)).toBe(true);
    expect(supportsVehicleCatalog(VehicleType.SUV)).toBe(true);
  });

  it('falls back to manual entry for unsupported vehicle types', () => {
    expect(supportsVehicleCatalog(VehicleType.Truck)).toBe(false);
    expect(supportsVehicleCatalog(VehicleType.Van)).toBe(false);
    expect(supportsVehicleCatalog(VehicleType.Other)).toBe(false);
  });
});
