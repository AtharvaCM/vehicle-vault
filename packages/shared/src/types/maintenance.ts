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

/**
 * How often one service is needed for one vehicle, as resolved by the API's
 * `MaintenanceIntervalResolver`.
 *
 * Lives here because it is an API↔Web contract: the web app must not restate
 * these numbers locally. A client that hardcodes its own interval will disagree
 * with the alert and forecast engines about the same vehicle.
 */
export interface VehicleServiceInterval {
  /** Kilometres between services; null when the interval is time-only. */
  km: number | null;
  /** Months between services; null when the interval is distance-only. */
  months: number | null;
  /** Per-variant catalog data, or the type/fuel-gated default table. */
  source: 'variant' | 'default';
}

/**
 * Only categories that apply to the vehicle are present — an EV carries no
 * engine-oil entry, a car no chain-service one. A missing category means "not
 * applicable", not "interval unknown".
 */
export type VehicleServiceIntervalMap = Partial<
  Record<MaintenanceCategory, VehicleServiceInterval>
>;
