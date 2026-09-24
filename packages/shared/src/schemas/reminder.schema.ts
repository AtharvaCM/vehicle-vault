import { z } from 'zod';

import { ReminderStatus, ReminderType } from '../enums';
import { VehicleDocumentKindSchema, type VehicleDocumentKind } from '../types/vehicle-document';

const isoDateTimeString = z.string().datetime({ offset: true });

/**
 * A reminder's **repeat rule**: completing it creates the next occurrence,
 * due this many months and/or kilometres later (whichever comes first when
 * both are set). Neither set: it does not repeat.
 */
export const REMINDER_REPEAT_MAX_MONTHS = 120;
export const REMINDER_REPEAT_MAX_KM = 200000;

const repeatEveryMonths = z.number().int().min(1).max(REMINDER_REPEAT_MAX_MONTHS);
const repeatEveryKm = z.number().int().min(1).max(REMINDER_REPEAT_MAX_KM);

/**
 * A **renewal**: a reminder of one of these types follows the vehicle's paper
 * of the matching kind. While linked, its due date is the paper's end date,
 * and renewing the paper completes it and links a successor to the new paper.
 */
export const RENEWAL_DOCUMENT_KIND_BY_REMINDER_TYPE: Partial<
  Record<
    ReminderType,
    Extract<VehicleDocumentKind, 'insurance' | 'puc' | 'road_tax' | 'registration'>
  >
> = {
  [ReminderType.Insurance]: 'insurance',
  [ReminderType.Puc]: 'puc',
  [ReminderType.Tax]: 'road_tax',
  [ReminderType.Registration]: 'registration',
};

export const ReminderCreateSchema = z
  .object({
    vehicleId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(120),
    type: z.nativeEnum(ReminderType),
    dueDate: isoDateTimeString.optional(),
    dueOdometer: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(1000).optional(),
    /** Null or absent: it does not repeat on that dimension. */
    repeatEveryMonths: repeatEveryMonths.nullable().optional(),
    repeatEveryKm: repeatEveryKm.nullable().optional(),
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
    /** Null stops it repeating on that dimension. */
    repeatEveryMonths: repeatEveryMonths.nullable().optional(),
    repeatEveryKm: repeatEveryKm.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one reminder field must be provided for update',
  });

export const UsageProjectionSchema = z.object({
  projectedDueDate: isoDateTimeString,
  kmPerDay: z.number().nonnegative(),
  confidence: z.enum(['high', 'medium', 'low']),
  sampleCount: z.number().int().nonnegative(),
  sampleDays: z.number().int().nonnegative(),
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
  /** The suggested-schedule item it was made from; absent for a hand-written one. */
  catalogSlug: z.string().optional(),
  repeatEveryMonths: repeatEveryMonths.optional(),
  repeatEveryKm: repeatEveryKm.optional(),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
  /**
   * The paper this renewal follows. Present while linked: `dueDate` is then
   * the paper's end date and cannot be set on the reminder itself.
   */
  renewsDocument: z.object({ kind: VehicleDocumentKindSchema, id: z.string().uuid() }).optional(),
  /**
   * Server-derived projection of when `dueOdometer` will be reached based on
   * recent fuel-log usage cadence. Present only when reminder has a
   * `dueOdometer` and the vehicle has enough fuel-log history.
   */
  usageProjection: UsageProjectionSchema.optional(),
});
