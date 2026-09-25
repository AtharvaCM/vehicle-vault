import { z } from 'zod';

import { MaintenanceCategory, MaintenanceRecordStatus, MaintenanceSource } from '../enums';
import {
  MaintenanceLineItemCreateSchema,
  MaintenanceLineItemSchema,
} from './maintenance-line-item.schema';

const isoDateTimeString = z.string().datetime({ offset: true });
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const MaintenanceRecordCreateSchema = z.object({
  vehicleId: z.string().trim().min(1),
  category: z.nativeEnum(MaintenanceCategory),
  serviceDate: isoDateTimeString,
  odometer: z.number().int().nonnegative(),
  workshopName: z.string().trim().max(120).optional(),
  invoiceNumber: z.string().trim().max(120).optional(),
  currencyCode: z.string().trim().length(3).optional(),
  source: z.nativeEnum(MaintenanceSource).optional(),
  status: z.nativeEnum(MaintenanceRecordStatus).optional(),
  totalCost: z.number().nonnegative(),
  laborCost: z.number().nonnegative().optional(),
  partsCost: z.number().nonnegative().optional(),
  fluidsCost: z.number().nonnegative().optional(),
  taxCost: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  notes: z.string().trim().max(1000).optional(),
  metadata: jsonObjectSchema.optional(),
  nextDueDate: isoDateTimeString.optional(),
  nextDueOdometer: z.number().int().nonnegative().optional(),
  lineItems: z.array(MaintenanceLineItemCreateSchema).optional(),
  /**
   * The reminder this service answers (the log-service form's `?reminderId=`).
   * Saving a confirmed record with it completes that reminder, and the next
   * occurrence is counted from this record. Not stored on the record.
   */
  reminderId: z.string().uuid().optional(),
});

export const MaintenanceRecordUpdateSchema = MaintenanceRecordCreateSchema.omit({
  vehicleId: true,
})
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one maintenance field must be provided for update',
  });

export const MaintenanceRecordSchema = MaintenanceRecordCreateSchema.omit({
  reminderId: true,
}).extend({
  id: z.string().trim().min(1),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
  lineItems: z.array(MaintenanceLineItemSchema).optional(),
});
