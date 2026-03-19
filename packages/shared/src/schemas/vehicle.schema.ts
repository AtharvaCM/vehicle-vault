import { z } from 'zod';

import { FuelType, VehicleType } from '../enums';

export const VehicleCreateSchema = z.object({
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.number().int().min(1900).max(2100),
  vehicleType: z.nativeEnum(VehicleType),
  fuelType: z.nativeEnum(FuelType),
  vin: z.string().trim().min(11).max(17).optional(),
  nickname: z.string().trim().min(1).max(80).optional(),
  mileage: z.number().int().nonnegative().optional(),
});
