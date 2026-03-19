import { z } from 'zod';

import { ReminderStatus, ReminderType } from '../enums';

const isoDateTimeString = z.string().datetime({ offset: true });

export const ReminderCreateSchema = z
  .object({
    vehicleId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(120),
    type: z.nativeEnum(ReminderType),
    dueDate: isoDateTimeString.optional(),
    dueOdometer: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.dueDate !== undefined || value.dueOdometer !== undefined, {
    message: 'At least one of dueDate or dueOdometer is required',
    path: ['dueDate'],
  });

export const ReminderUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    type: z.nativeEnum(ReminderType).optional(),
    dueDate: isoDateTimeString.optional(),
    dueOdometer: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one reminder field must be provided for update',
  });

export const ReminderSchema = z.object({
  id: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(120),
  type: z.nativeEnum(ReminderType),
  dueDate: isoDateTimeString.optional(),
  dueOdometer: z.number().int().nonnegative().optional(),
  status: z.nativeEnum(ReminderStatus),
  completedAt: isoDateTimeString.optional(),
  notes: z.string().trim().max(1000).optional(),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
});
