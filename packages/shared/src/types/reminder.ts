import type { z } from 'zod';

import {
  ReminderCreateSchema,
  ReminderSchema,
  ReminderUpdateSchema,
  UsageProjectionSchema,
} from '../schemas';

export type CreateReminderInput = z.infer<typeof ReminderCreateSchema>;
export type UpdateReminderInput = z.infer<typeof ReminderUpdateSchema>;
export type Reminder = z.infer<typeof ReminderSchema>;
export type UsageProjection = z.infer<typeof UsageProjectionSchema>;
