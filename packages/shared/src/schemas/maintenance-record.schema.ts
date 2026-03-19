import { z } from 'zod';

import { MaintenanceCategory, ReminderType } from '../enums';

export const MaintenanceRecordCreateSchema = z.object({
  vehicleId: z.string().uuid(),
  category: z.nativeEnum(MaintenanceCategory),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date string'),
  mileage: z.number().int().nonnegative(),
  amount: z.number().nonnegative().optional(),
  notes: z.string().trim().max(500).optional(),
  reminderType: z.nativeEnum(ReminderType).optional(),
});
