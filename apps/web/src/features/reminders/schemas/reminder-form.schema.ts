import {
  REMINDER_REPEAT_MAX_KM,
  REMINDER_REPEAT_MAX_MONTHS,
  ReminderType,
} from '@vehicle-vault/shared';
import { z } from 'zod';

import { format } from '@/lib/format';

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
    repeat: z.enum(['none', 'six-months', 'yearly', 'distance', 'custom']),
    repeatEveryMonths: z
      .number({ invalid_type_error: 'Enter a number of months' })
      .int('Use whole months')
      .min(1, 'Repeat at least every month')
      .max(REMINDER_REPEAT_MAX_MONTHS, `At most every ${REMINDER_REPEAT_MAX_MONTHS} months`)
      .optional(),
    repeatEveryKm: z
      .number({ invalid_type_error: 'Enter a distance in km' })
      .int('Use whole kilometres')
      .min(1, 'Repeat at least every kilometre')
      .max(REMINDER_REPEAT_MAX_KM, `At most every ${format.distance(REMINDER_REPEAT_MAX_KM)}`)
      .optional(),
  })
  .refine((value) => value.dueDate?.trim() || value.dueOdometer !== undefined, {
    message: 'Add a due date or due odometer',
    path: ['dueDate'],
  })
  .refine((value) => value.repeat !== 'distance' || value.repeatEveryKm !== undefined, {
    message: 'Enter how many km between reminders',
    path: ['repeatEveryKm'],
  })
  .refine(
    (value) =>
      value.repeat !== 'custom' ||
      value.repeatEveryMonths !== undefined ||
      value.repeatEveryKm !== undefined,
    {
      message: 'Enter months, kilometres, or both',
      path: ['repeatEveryMonths'],
    },
  );

export type ReminderFormValues = z.infer<typeof reminderFormSchema>;
