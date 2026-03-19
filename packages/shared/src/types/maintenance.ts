import type { z } from 'zod';

import {
  MaintenanceRecordCreateSchema,
  MaintenanceRecordSchema,
  MaintenanceRecordUpdateSchema,
} from '../schemas';

export type CreateMaintenanceRecordInput = z.infer<typeof MaintenanceRecordCreateSchema>;
export type UpdateMaintenanceRecordInput = z.infer<typeof MaintenanceRecordUpdateSchema>;
export type MaintenanceRecord = z.infer<typeof MaintenanceRecordSchema>;
