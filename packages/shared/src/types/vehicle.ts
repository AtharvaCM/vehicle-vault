import type { z } from 'zod';

import { VehicleType } from '../enums/vehicle-type.enum';
import {
  VehicleCreateRequestSchema,
  VehicleCreateSchema,
  VehicleSchema,
  VehicleUpdateSchema,
} from '../schemas';

export type CreateVehicleInput = z.infer<typeof VehicleCreateSchema>;
export type CreateVehicleRequest = z.infer<typeof VehicleCreateRequestSchema>;
export type UpdateVehicleInput = z.infer<typeof VehicleUpdateSchema>;
export type Vehicle = z.infer<typeof VehicleSchema>;

/**
 * Two-wheelers have a front and rear tyre, not four corners plus a spare, and
 * carry no rotation service of their own. `VehicleType` has no separate
 * `Scooter` value today, so this currently matches only `Motorcycle` — but
 * callers should go through this helper rather than compare the enum
 * directly, so a future split stays a one-line change.
 */
export function isTwoWheeler(vehicleType: VehicleType): boolean {
  return vehicleType === VehicleType.Motorcycle;
}
