import { z } from 'zod';

/**
 * Form-shaped rather than the wire shape: dates are `yyyy-MM-dd` from a native
 * date input, and every optional text field arrives as `''` rather than
 * undefined because react-hook-form never gives you undefined from `register`.
 * The submit mapper is what turns those into nulls and ISO strings.
 */
export const accessoryFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(120, 'Name can be at most 120 characters'),
    brand: z.string().trim().max(80, 'Brand can be at most 80 characters').optional(),
    category: z.string().trim().max(60, 'Category can be at most 60 characters').optional(),
    purchaseDate: z.string().trim().min(1, 'Purchase date is required'),
    cost: z.number().nonnegative('Cost cannot be negative'),
    fittedDate: z.string().trim().optional(),
    fittedOdometer: z.number().int().nonnegative('Odometer cannot be negative').optional(),
    removedDate: z.string().trim().optional(),
    removedOdometer: z.number().int().nonnegative('Odometer cannot be negative').optional(),
    warrantyExpiresAt: z.string().trim().optional(),
    notes: z.string().trim().max(1000, 'Notes can be at most 1000 characters').optional(),
  })
  // An accessory can be bought and never fitted, but it cannot come off
  // something it was never on.
  .refine((value) => !value.removedDate || Boolean(value.fittedDate), {
    message: 'Set a fitted date before recording a removal',
    path: ['removedDate'],
  })
  .refine(
    (value) =>
      !value.removedDate ||
      !value.fittedDate ||
      Date.parse(value.removedDate) >= Date.parse(value.fittedDate),
    {
      message: 'Removal cannot be earlier than fitment',
      path: ['removedDate'],
    },
  )
  .refine(
    (value) =>
      value.removedOdometer == null ||
      value.fittedOdometer == null ||
      value.removedOdometer >= value.fittedOdometer,
    {
      message: 'Removal odometer cannot be lower than the fitted odometer',
      path: ['removedOdometer'],
    },
  );

export type AccessoryFormValues = z.infer<typeof accessoryFormSchema>;

/** `yyyy-MM-dd` from a date input to the ISO instant the API expects. */
export function toIsoDate(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** ISO instant back to the `yyyy-MM-dd` a date input can display. */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}
