import { z } from 'zod';

import { MaintenanceCategory } from '../enums/maintenance-category.enum';
import { ServiceBaselineStatus } from '../enums/service-baseline-status.enum';

const isoDateTimeString = z.string().datetime({ offset: true });

const serviceBaselineFields = z.object({
  category: z.nativeEnum(MaintenanceCategory),
  status: z.nativeEnum(ServiceBaselineStatus),
  /** Odometer at which this category was last done before the vault knew the vehicle. */
  lastDoneOdometer: z.number().int().nonnegative().optional().nullable(),
  lastDoneDate: isoDateTimeString.optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

/**
 * Mirrors the `service_baseline_status_matches_figures` CHECK constraint.
 *
 * Enforced here as well as in the database because the two answers mean
 * different things downstream — an `unknown` baseline raises an alert, a `known`
 * one silences it — and a row that says `known` while carrying nothing would
 * silence the alert without ever supplying a figure to measure from.
 */
export const ServiceBaselineEntrySchema = serviceBaselineFields.superRefine((value, ctx) => {
  const hasFigure = value.lastDoneOdometer != null || value.lastDoneDate != null;

  if (value.status === ServiceBaselineStatus.Known && !hasFigure) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A known baseline needs lastDoneOdometer or lastDoneDate',
      path: ['status'],
    });
  }

  if (value.status === ServiceBaselineStatus.Unknown && hasFigure) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'An unknown baseline cannot carry lastDoneOdometer or lastDoneDate',
      path: ['status'],
    });
  }
});

/**
 * Onboarding answers arrive a screenful at a time, so the write is a batch.
 *
 * Categories absent from `entries` are left alone rather than cleared: a user
 * answering three questions has not retracted the other seven, and a partial
 * capture is the normal case for a vehicle whose history is being reconstructed
 * from memory.
 */
export const ServiceBaselineUpsertSchema = z.object({
  entries: z
    .array(ServiceBaselineEntrySchema)
    .min(1, 'At least one baseline entry is required')
    .max(40)
    .superRefine((entries, ctx) => {
      const seen = new Set<MaintenanceCategory>();
      for (const entry of entries) {
        if (seen.has(entry.category)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate baseline entry for category "${entry.category}"`,
            path: ['entries'],
          });
        }
        seen.add(entry.category);
      }
    }),
});

export const ServiceBaselineSchema = serviceBaselineFields.extend({
  id: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
});
