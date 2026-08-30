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
 * An accessory can be bought and never fitted, but it cannot come off something
 * it was never on. Both predicates take every field as optional so the same rule
 * can guard the partial update shape.
 */
function hasCoherentFitment(value: { fittedDate?: string | null; removedDate?: string | null }) {
  return value.removedDate == null || value.fittedDate != null;
}

function hasCoherentRemovalDate(value: { fittedDate?: string | null; removedDate?: string | null }) {
  return (
    value.removedDate == null ||
    value.fittedDate == null ||
    Date.parse(value.removedDate) >= Date.parse(value.fittedDate)
  );
}

function hasCoherentRemovalOdometer(value: {
  fittedOdometer?: number | null;
  removedOdometer?: number | null;
}) {
  return (
    value.removedOdometer == null ||
    value.fittedOdometer == null ||
    value.removedOdometer >= value.fittedOdometer
  );
}

export const AccessoryCreateSchema = accessoryFields
  .refine(hasCoherentFitment, {
    message: 'removedDate requires a fittedDate',
    path: ['removedDate'],
  })
  .refine(hasCoherentRemovalDate, {
    message: 'removedDate cannot be earlier than fittedDate',
    path: ['removedDate'],
  })
  .refine(hasCoherentRemovalOdometer, {
    message: 'removedOdometer cannot be lower than fittedOdometer',
    path: ['removedOdometer'],
  });

export const AccessoryUpdateSchema = accessoryFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one accessory field must be provided for update',
  })
  .refine(hasCoherentFitment, {
    message: 'removedDate requires a fittedDate',
    path: ['removedDate'],
  })
  .refine(hasCoherentRemovalDate, {
    message: 'removedDate cannot be earlier than fittedDate',
    path: ['removedDate'],
  })
  .refine(hasCoherentRemovalOdometer, {
    message: 'removedOdometer cannot be lower than fittedOdometer',
    path: ['removedOdometer'],
  });

export const AccessorySchema = accessoryFields.extend({
  id: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  currencyCode: z.string().trim().length(3),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
});
