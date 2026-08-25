import { z } from 'zod';

import { TyrePosition } from '../enums';

const isoDateTimeString = z.string().datetime({ offset: true });

/**
 * The DOT code stamped on every tyre sidewall: manufacture week 1–53 and year.
 * Rubber hardens and cracks on a calendar regardless of distance covered, so
 * this is the only field that can catch a barely-used tyre that has aged out.
 */
const dotWeek = z.number().int().min(1).max(53);
const dotYear = z.number().int().min(1980).max(2100);

/** Millimetres of remaining tread. 1.6 mm is the legal minimum in India. */
const treadDepthMm = z.number().min(0).max(30);

const pressurePsi = z.number().min(0).max(120);

const tyreFields = z.object({
  position: z.nativeEnum(TyrePosition),
  brand: z.string().trim().max(80).optional().nullable(),
  model: z.string().trim().max(80).optional().nullable(),
  /** Sidewall size code, e.g. "205/55 R16". */
  size: z.string().trim().max(40).optional().nullable(),
  dotWeek: dotWeek.optional().nullable(),
  dotYear: dotYear.optional().nullable(),
  fittedDate: isoDateTimeString,
  fittedOdometer: z.number().int().nonnegative(),
  /** Null means currently fitted. */
  removedDate: isoDateTimeString.optional().nullable(),
  removedOdometer: z.number().int().nonnegative().optional().nullable(),
  expectedLifeKm: z.number().int().positive().max(500_000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

/**
 * A DOT week without its year cannot be dated, and a year without a week is a
 * 12-month guess. Both halves or neither.
 */
function hasCoherentDotCode(value: { dotWeek?: number | null; dotYear?: number | null }) {
  return (value.dotWeek == null) === (value.dotYear == null);
}

function hasCoherentRemoval(value: { fittedOdometer?: number; removedOdometer?: number | null }) {
  return (
    value.removedOdometer == null ||
    value.fittedOdometer == null ||
    value.removedOdometer >= value.fittedOdometer
  );
}

export const TyreCreateSchema = tyreFields
  .refine(hasCoherentRemoval, {
    message: 'removedOdometer cannot be lower than fittedOdometer',
    path: ['removedOdometer'],
  })
  .refine(hasCoherentDotCode, {
    message: 'dotWeek and dotYear must be supplied together',
    path: ['dotWeek'],
  });

export const TyreUpdateSchema = tyreFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one tyre field must be provided for update',
  })
  .refine(hasCoherentRemoval, {
    message: 'removedOdometer cannot be lower than fittedOdometer',
    path: ['removedOdometer'],
  })
  .refine(hasCoherentDotCode, {
    message: 'dotWeek and dotYear must be supplied together',
    path: ['dotWeek'],
  });

export const TyreSchema = tyreFields.extend({
  id: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
});

const tyreInspectionFields = z.object({
  tyreId: z.string().trim().min(1),
  inspectedAt: isoDateTimeString,
  odometer: z.number().int().nonnegative(),
  treadDepthMm: treadDepthMm.optional().nullable(),
  pressurePsi: pressurePsi.optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const TyreInspectionCreateSchema = tyreInspectionFields.refine(
  // An inspection that measured nothing is not a record of anything.
  (value) => value.treadDepthMm != null || value.pressurePsi != null,
  {
    message: 'An inspection must record at least a tread depth or a pressure',
    path: ['treadDepthMm'],
  },
);

export const TyreInspectionSchema = tyreInspectionFields.extend({
  id: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  createdAt: isoDateTimeString,
  updatedAt: isoDateTimeString,
});
