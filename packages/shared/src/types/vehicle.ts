import type { z } from 'zod';

import { VehicleCreateSchema, VehicleSchema, VehicleUpdateSchema } from '../schemas';

export type CreateVehicleInput = z.infer<typeof VehicleCreateSchema>;
export type UpdateVehicleInput = z.infer<typeof VehicleUpdateSchema>;
export type Vehicle = z.infer<typeof VehicleSchema>;
