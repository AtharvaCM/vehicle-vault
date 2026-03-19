import type { z } from 'zod';

import { MaintenanceRecordCreateSchema } from '../schemas';

export type CreateMaintenanceRecordInput = z.infer<typeof MaintenanceRecordCreateSchema>;
