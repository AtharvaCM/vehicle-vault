import { MaintenanceCategory } from '@vehicle-vault/shared';
import { z } from 'zod';

export const maintenanceFormSchema = z.object({
  serviceDate: z.string().trim().min(1, 'Service date is required'),
  odometer: z.number().nonnegative('Odometer cannot be negative'),
  category: z.nativeEnum(MaintenanceCategory),
  workshopName: z.string().trim().min(1, 'Workshop name is required'),
  totalCost: z.number().nonnegative('Total cost cannot be negative'),
  notes: z.string().trim().max(500, 'Notes can be at most 500 characters').optional(),
});

export type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>;
