import { z } from 'zod';

import { FuelType, VehicleType } from '../enums';

export const VehicleCreateSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(20),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  variant: z.string().trim().min(1).max(80),
  year: z.number().int().min(1900).max(2100),
  vehicleType: z.nativeEnum(VehicleType),
  fuelType: z.nativeEnum(FuelType),
  nickname: z.string().trim().min(1).max(80).optional(),
  odometer: z.number().int().nonnegative(),
});

export const VehicleUpdateSchema = VehicleCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one vehicle field must be provided',
  },
);

export const VehicleSchema = VehicleCreateSchema.extend({
  id: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
