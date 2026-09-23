import { PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES, VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { pathVehicleTypes } from '../../../prisma/catalog-import/generation-redirects';

describe('pathVehicleTypes', () => {
  // The catalog scripts spell the `/cars` body types out because they run before
  // the shared package is built; this keeps the two lists from drifting apart.
  it('spans the same body types as the public `/cars` segment', () => {
    for (const vehicleType of PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES.cars) {
      expect([...pathVehicleTypes(vehicleType)].sort()).toEqual(
        [...PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES.cars].sort(),
      );
    }
  });

  it('keeps any other body type on its own', () => {
    expect(pathVehicleTypes(VehicleType.Motorcycle)).toEqual([VehicleType.Motorcycle]);
    expect(pathVehicleTypes(VehicleType.Truck)).toEqual([VehicleType.Truck]);
  });
});
