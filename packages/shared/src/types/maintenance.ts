import type { z } from 'zod';

import {
  MaintenanceLineItemCreateSchema,
  MaintenanceLineItemSchema,
  MaintenanceRecordCreateSchema,
  MaintenanceRecordSchema,
  MaintenanceRecordUpdateSchema,
} from '../schemas';

import { MaintenanceCategory } from '../enums/maintenance-category.enum';

export type CreateMaintenanceLineItemInput = z.infer<typeof MaintenanceLineItemCreateSchema>;
export type MaintenanceLineItem = z.infer<typeof MaintenanceLineItemSchema>;
export type CreateMaintenanceRecordInput = z.infer<typeof MaintenanceRecordCreateSchema>;
export type UpdateMaintenanceRecordInput = z.infer<typeof MaintenanceRecordUpdateSchema>;
export type MaintenanceRecord = z.infer<typeof MaintenanceRecordSchema>;

export interface MaintenanceSuggestion {
  category: MaintenanceCategory;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  estimatedOdometerDue?: number;
  estimatedDateDue?: string;
  vehicleId?: string;
  vehicleLabel?: string;
}
