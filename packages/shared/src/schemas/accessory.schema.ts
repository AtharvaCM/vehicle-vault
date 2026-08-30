import { z } from 'zod';

const isoDateTimeString = z.string().datetime({ offset: true });

const accessoryFields = z.object({
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80).optional().nullable(),
  /**
   * Free text on purpose. A closed vocabulary is what pushed accessories into
   * MaintenanceCategory in the first place; a real one can be distilled from
   * what people actually type, and that direction is a data question rather
   * than a migration.
   */
  category: z.string().trim().max(60).optional().nullable(),
  purchaseDate: isoDateTimeString,
  cost: z.number().nonnegative(),
  currencyCode: z.string().trim().length(3).optional(),
  /** Null while the item is owned but not yet on the vehicle. */
  fittedDate: isoDateTimeString.optional().nullable(),
  fittedOdometer: z.number().int().nonnegative().optional().nullable(),
  /** Null with a fittedDate present means currently fitted. */
  removedDate: isoDateTimeString.optional().nullable(),
  removedOdometer: z.number().int().nonnegative().optional().nullable(),
  /** Warranty on the item itself, which runs on the calendar, not on distance. */
  warrantyExpiresAt: isoDateTimeString.optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

/**
 * The fitment rules, expressed over a WHOLE accessory rather than over whichever
 * fields a caller happened to send.
 *
 * They cannot live as `.refine`s on the update schema. A patch is validated in
 * isolation, so `{ removedDate }` alone would look like a removal with no
 * fitment and be rejected even when the stored row has one, while
 * `{ fittedDate: null }` alone would sail past the rule it violates. A partial
 * update has to be checked against the row it will produce, which only the
 * service can assemble — see `assertCoherentAccessory`.
 */
export type AccessoryCoherenceView = {
  fittedDate?: string | null;
  fittedOdometer?: number | null;
  removedDate?: string | null;
  removedOdometer?: number | null;
};

export type AccessoryCoherenceIssue = { message: string; path: string[] };

export function findAccessoryCoherenceIssues(
  value: AccessoryCoherenceView,
): AccessoryCoherenceIssue[] {
  const issues: AccessoryCoherenceIssue[] = [];

  // An accessory can be bought and never fitted, but it cannot come off
  // something it was never on.
  if (value.removedDate != null && value.fittedDate == null) {
    issues.push({ message: 'removedDate requires a fittedDate', path: ['removedDate'] });
  }

  if (
    value.removedDate != null &&
    value.fittedDate != null &&
    Date.parse(value.removedDate) < Date.parse(value.fittedDate)
  ) {
    issues.push({
      message: 'removedDate cannot be earlier than fittedDate',
      path: ['removedDate'],
    });
  }

  if (
    value.removedOdometer != null &&
    value.fittedOdometer != null &&
    value.removedOdometer < value.fittedOdometer
  ) {
    issues.push({
      message: 'removedOdometer cannot be lower than fittedOdometer',
      path: ['removedOdometer'],
    });
  }

  return issues;
}

/** A create carries the whole accessory, so the rules can be applied directly. */
export const AccessoryCreateSchema = accessoryFields.superRefine((value, ctx) => {
  for (const issue of findAccessoryCoherenceIssues(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: issue.path });
  }
});

/**
 * Shape only. The fitment rules are deliberately absent: they need the merged
 * row, not the patch, and the service applies them once it has one.
 */
export const AccessoryUpdateSchema = accessoryFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one accessory field must be provided for update',
  });

export const AccessorySchema = accessoryFields.extend({
  id: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  currencyCode: z.string().trim().length(3),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
});
