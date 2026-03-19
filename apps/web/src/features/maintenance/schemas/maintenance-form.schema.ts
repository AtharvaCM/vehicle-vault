import { MaintenanceCategory } from '@vehicle-vault/shared';
import { z } from 'zod';

export const maintenanceFormSchema = z.object({
  serviceDate: z.string().trim().min(1, 'Service date is required'),
  odometer: z.number().int().nonnegative('Odometer cannot be negative'),
  category: z.nativeEnum(MaintenanceCategory),
  workshopName: z
    .string()
    .trim()
    .max(120, 'Workshop name can be at most 120 characters')
    .optional(),
  totalCost: z.number().nonnegative('Total cost cannot be negative'),
  notes: z.string().trim().max(1000, 'Notes can be at most 1000 characters').optional(),
  nextDueDate: z.string().trim().optional(),
  nextDueOdometer: z.number().int().nonnegative('Next due odometer cannot be negative').optional(),
});

export type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>;
