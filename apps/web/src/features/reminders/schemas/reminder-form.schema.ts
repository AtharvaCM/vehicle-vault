import { ReminderType } from '@vehicle-vault/shared';
import { z } from 'zod';

export const reminderFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(120, 'Title can be at most 120 characters'),
    type: z.nativeEnum(ReminderType),
    dueDate: z.string().trim().optional(),
    dueOdometer: z.number().int().nonnegative('Due odometer cannot be negative').optional(),
    notes: z.string().trim().max(1000, 'Notes can be at most 1000 characters').optional(),
  })
  .refine((value) => value.dueDate?.trim() || value.dueOdometer !== undefined, {
    message: 'Add a due date or due odometer',
    path: ['dueDate'],
  });

export type ReminderFormValues = z.infer<typeof reminderFormSchema>;
