import { TyrePosition } from '@vehicle-vault/shared';
import { z } from 'zod';

/**
 * The sidewall stamps manufacture date as four digits — week then year, so
 * "3624" is week 36 of 2024. Asking for the code as printed beats asking for
 * two numbers the user then has to derive.
 */
const DOT_CODE_PATTERN = /^\d{4}$/;

export const tyreFormSchema = z
  .object({
    position: z.nativeEnum(TyrePosition),
    brand: z.string().trim().max(80, 'Brand can be at most 80 characters').optional(),
    model: z.string().trim().max(80, 'Model can be at most 80 characters').optional(),
    size: z.string().trim().max(40, 'Size can be at most 40 characters').optional(),
    dotCode: z
      .string()
      .trim()
      .refine((value) => value === '' || DOT_CODE_PATTERN.test(value), {
        message: 'Enter the four-digit DOT code, e.g. 3624 for week 36 of 2024',
      })
      .optional(),
    fittedDate: z.string().trim().min(1, 'Fitted date is required'),
    fittedOdometer: z.number().int().nonnegative('Odometer cannot be negative'),
    expectedLifeKm: z
      .number()
      .int()
      .positive('Expected life must be greater than zero')
      .max(500_000, 'Expected life looks too large')
      .optional(),
    notes: z.string().trim().max(1000, 'Notes can be at most 1000 characters').optional(),
  })
  .refine((value) => value.dotCode === '' || parseDotCode(value.dotCode) !== null, {
    message: 'DOT week must be between 01 and 53',
    path: ['dotCode'],
  });

export type TyreFormValues = z.infer<typeof tyreFormSchema>;

/**
 * Splits "3624" into week 36, year 2024. The two-digit year is resolved against
 * the current century, then pulled back a century if that would place the tyre
 * in the future — a tyre cannot be manufactured after today.
 */
export function parseDotCode(
  code: string | undefined,
  now = new Date(),
): { week: number; year: number } | null {
  if (!code || !DOT_CODE_PATTERN.test(code)) return null;

  const week = Number(code.slice(0, 2));
  if (week < 1 || week > 53) return null;

  const century = Math.floor(now.getFullYear() / 100) * 100;
  let year = century + Number(code.slice(2));
  if (year > now.getFullYear()) year -= 100;

  return { week, year };
}

/** Renders week/year back into the four digits printed on the sidewall. */
export function formatDotCode(week: number | null, year: number | null): string {
  if (week == null || year == null) return '';
  return `${String(week).padStart(2, '0')}${String(year % 100).padStart(2, '0')}`;
}

const readingSchema = z.object({
  tyreId: z.string(),
  treadDepthMm: z
    .number()
    .min(0, 'Tread depth cannot be negative')
    .max(30, 'Tread depth looks too large')
    .optional(),
  pressurePsi: z
    .number()
    .min(0, 'Pressure cannot be negative')
    .max(120, 'Pressure looks too high')
    .optional(),
});

export const tyreInspectionFormSchema = z
  .object({
    inspectedAt: z.string().trim().min(1, 'Inspection date is required'),
    odometer: z.number().int().nonnegative('Odometer cannot be negative'),
    notes: z.string().trim().max(1000, 'Notes can be at most 1000 characters').optional(),
    readings: z.array(readingSchema),
  })
  // Submitting a walk-around where nothing was written down would create rows
  // that record no measurement.
  .refine((value) => value.readings.some(hasReading), {
    message: 'Record a tread depth or pressure for at least one tyre',
    path: ['readings'],
  });

export type TyreInspectionFormValues = z.infer<typeof tyreInspectionFormSchema>;
export type TyreReadingValues = z.infer<typeof readingSchema>;

export function hasReading(reading: TyreReadingValues): boolean {
  return reading.treadDepthMm != null || reading.pressurePsi != null;
}
