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

/**
 * A field "Fill in from photo" can write on a confirmed record, and only ever
 * while the record leaves it blank. The date, odometer and cost are not here:
 * they are what was typed, and the photo never replaces them.
 */
export type MaintenanceFillField =
  | 'category'
  | 'workshopName'
  | 'invoiceNumber'
  | 'notes'
  | 'lineItems'
  | 'nextDueDate'
  | 'nextDueOdometer';

/** What filling a confirmed record in from an attachment's extraction would write. */
export type MaintenanceFillPlan = {
  /** The blanks the extraction fills, in the order to show them; empty when it adds nothing. */
  fields: MaintenanceFillField[];
  /** Those values, as the update that writes them. */
  changes: UpdateMaintenanceRecordInput;
  /**
   * Line items the extraction found but the fill leaves out, because they add
   * up to something other than the record's cost.
   */
  lineItemsLeftOut?: { count: number; total: number };
};

export type MaintenanceFillResult = {
  record: MaintenanceRecord;
  /** What the fill wrote; empty when the record had nothing left blank that the photo shows. */
  filledFields: MaintenanceFillField[];
};

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
