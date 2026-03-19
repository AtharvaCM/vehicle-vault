import type { z } from 'zod';

import { VehicleCreateSchema } from '../schemas';

export type CreateVehicleInput = z.infer<typeof VehicleCreateSchema>;
