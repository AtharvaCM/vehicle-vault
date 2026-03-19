import { z } from 'zod';

import { MaintenanceCategory } from '../enums';

const isoDateTimeString = z.string().datetime({ offset: true });

export const MaintenanceRecordCreateSchema = z.object({
  vehicleId: z.string().trim().min(1),
  category: z.nativeEnum(MaintenanceCategory),
  serviceDate: isoDateTimeString,
  odometer: z.number().int().nonnegative(),
  workshopName: z.string().trim().max(120).optional(),
  totalCost: z.number().nonnegative(),
  notes: z.string().trim().max(1000).optional(),
  nextDueDate: isoDateTimeString.optional(),
  nextDueOdometer: z.number().int().nonnegative().optional(),
});

export const MaintenanceRecordUpdateSchema = MaintenanceRecordCreateSchema.omit({
  vehicleId: true,
})
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one maintenance field must be provided for update',
  });

export const MaintenanceRecordSchema = MaintenanceRecordCreateSchema.extend({
  id: z.string().trim().min(1),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
});
