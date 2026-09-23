import { z } from 'zod';

import { FuelType, VehicleRole, VehicleType } from '../enums';

export const VehicleCreateSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(20),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  /**
   * Optional: finding the exact trim is the longest step in adding a vehicle,
   * and the catalog link falls back to the generation when it is missing.
   */
  variant: z.string().trim().min(1).max(80).optional(),
  year: z.number().int().min(1900).max(2100),
  vehicleType: z.nativeEnum(VehicleType),
  fuelType: z.nativeEnum(FuelType),
  nickname: z.string().trim().min(1).max(80).optional(),
  odometer: z.number().int().nonnegative(),
  catalogVariantId: z.string().uuid().optional(),
  purchaseDate: z.string().datetime().optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  purchaseOdometer: z.number().int().nonnegative().optional().nullable(),
});

/**
 * What `POST /vehicles` accepts: a vehicle, plus whether the form was opened
 * prefilled from a catalog intent ("Track this vehicle" on a public catalog
 * page). The flag is attribution for `vehicle_created` and is never stored on
 * the vehicle, so it stays out of `VehicleCreateSchema`, which the update and
 * read shapes build on.
 */
export const VehicleCreateRequestSchema = VehicleCreateSchema.extend({
  fromCatalogIntent: z.literal(true).optional(),
});

/**
 * An edit can clear the optional text fields, which only an explicit `null`
 * does: an absent (`undefined`) field means "leave it as it is".
 */
export const VehicleUpdateSchema = VehicleCreateSchema.extend({
  variant: VehicleCreateSchema.shape.variant.nullable(),
  nickname: VehicleCreateSchema.shape.nickname.nullable(),
})
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one vehicle field must be provided',
  });

export const VehicleSchema = VehicleCreateSchema.extend({
  id: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  catalogVariantId: z.string().uuid().optional().nullable(),
  /** Current user's role on this vehicle. Omitted by older API versions. */
  currentUserRole: z.nativeEnum(VehicleRole).optional(),
  /**
   * When the insurance-and-PUC expiry prompt a new vehicle lands on was
   * answered or skipped. Null means it has never been put away, which is what
   * makes the prompt show. Omitted by older API versions.
   */
  setupPromptDismissedAt: z.string().datetime().nullable().optional(),
});
