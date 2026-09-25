import { z } from 'zod';

import { FuelType, VehicleRole, VehicleType } from '../enums';

/**
 * The three Indian registration formats this app recognises, with capturing
 * groups so a caller can both validate a plate and split it into the groups
 * it prints: state · district · series · number, year · BH · number ·
 * series, or (a brand-new vehicle, before its permanent plate) T · MMYY ·
 * state · number · series. The single source both the web's plate
 * input/display and this schema's validation match a registration against.
 */
// MH12DM0002, DL3CAB1234, KA01EV2024, and an older MH121234 with no series.
export const STANDARD_REGISTRATION = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
// Bharat series: 22BH1234AA (year of registration, BH, number, series).
export const BHARAT_REGISTRATION = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/;
// Temporary registration (MoRTH, 2021): T0724HR6123A — T, month+year of issue,
// state code, a 4-digit number, and a 1–2 letter series. Carried until the
// permanent plate arrives, which is why a brand-new vehicle is added with one.
export const TEMPORARY_REGISTRATION = /^(T)(\d{4})([A-Z]{2})(\d{4})([A-Z]{1,2})$/;

/** Upper-cased, spaces and punctuation stripped: what the formats are matched against. */
export function compactRegistrationNumber(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Whether a registration, in any spacing or case, is a recognised Indian plate. */
export function isValidRegistrationNumber(value: string): boolean {
  const compact = compactRegistrationNumber(value);
  return (
    STANDARD_REGISTRATION.test(compact) ||
    BHARAT_REGISTRATION.test(compact) ||
    TEMPORARY_REGISTRATION.test(compact)
  );
}

/** What both this schema's refine and the web's own blur-time check report for a bad plate. */
export const INVALID_REGISTRATION_MESSAGE =
  'Enter a valid Indian registration number, e.g. MH12AB1234, 22BH1234AA or a temporary T0724HR6123A';

export const VehicleCreateSchema = z.object({
  /**
   * Stored compact (MH12DM0002), however it was typed or shown: the plate
   * input groups it as it prints, and the per-owner unique index and every
   * comparison only hold if one plate has one spelling.
   */
  registrationNumber: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform(compactRegistrationNumber)
    .refine(isValidRegistrationNumber, {
      message: INVALID_REGISTRATION_MESSAGE,
    }),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  /**
   * Optional: finding the exact trim is the longest step in adding a vehicle,
   * and the catalog link falls back to the generation when it is missing.
   */
  variant: z.string().trim().min(1).max(80).optional(),
  year: z.number().int().min(1900).max(2100),
  vehicleType: z.nativeEnum(VehicleType),
  fuelType: z.nativeEnum(FuelType),
  nickname: z.string().trim().min(1).max(80).optional(),
  odometer: z.number().int().nonnegative(),
  catalogVariantId: z.string().uuid().optional(),
  purchaseDate: z.string().datetime().optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  purchaseOdometer: z.number().int().nonnegative().optional().nullable(),
});

/**
 * What `POST /vehicles` accepts: a vehicle, plus whether the form was opened
 * prefilled from a catalog intent ("Track this vehicle" on a public catalog
 * page). The flag is attribution for `vehicle_created` and is never stored on
 * the vehicle, so it stays out of `VehicleCreateSchema`, which the update and
 * read shapes build on.
 */
export const VehicleCreateRequestSchema = VehicleCreateSchema.extend({
  fromCatalogIntent: z.literal(true).optional(),
});

/**
 * An edit can clear the optional text fields, which only an explicit `null`
 * does: an absent (`undefined`) field means "leave it as it is".
 */
export const VehicleUpdateSchema = VehicleCreateSchema.extend({
  variant: VehicleCreateSchema.shape.variant.nullable(),
  nickname: VehicleCreateSchema.shape.nickname.nullable(),
})
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one vehicle field must be provided',
  });

export const VehicleSchema = VehicleCreateSchema.extend({
  id: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  catalogVariantId: z.string().uuid().optional().nullable(),
  /** Current user's role on this vehicle. Omitted by older API versions. */
  currentUserRole: z.nativeEnum(VehicleRole).optional(),
  /**
   * When the insurance-and-PUC expiry prompt a new vehicle lands on was
   * answered or skipped. Null means it has never been put away, which is what
   * makes the prompt show. Omitted by older API versions.
   */
  setupPromptDismissedAt: z.string().datetime().nullable().optional(),
});
