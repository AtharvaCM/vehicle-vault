import { z } from 'zod';

import { MaintenanceCategory, ReminderType } from '../enums';

export const MaintenanceRecordCreateSchema = z.object({
  vehicleId: z.string().trim().min(1),
  category: z.nativeEnum(MaintenanceCategory),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date string'),
  odometer: z.number().int().nonnegative(),
  workshopName: z.string().trim().min(1).max(120),
  totalCost: z.number().nonnegative(),
  notes: z.string().trim().max(500).optional(),
  reminderType: z.nativeEnum(ReminderType).optional(),
});
