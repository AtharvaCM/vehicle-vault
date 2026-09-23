import { z } from 'zod';

/**
 * An empty number input reaches the schema as NaN, which is a type error, so
 * each number's "missing" message is its `invalid_type_error`: the friendly
 * range messages below only ever see a real number.
 */
export const fuelLogFormSchema = z.object({
  date: z.string().min(1, 'Enter the date of the fill'),
  odometer: z
    .number({ invalid_type_error: 'Enter the odometer reading' })
    .int('Enter the reading in whole kilometres')
    .nonnegative('Odometer cannot be negative'),
  quantity: z
    .number({ invalid_type_error: 'Enter the litres' })
    .positive('Litres must be more than 0'),
  price: z
    .number({ invalid_type_error: 'Enter the price per litre' })
    .positive('Price per litre must be more than 0'),
  totalCost: z
    .number({ invalid_type_error: 'Enter the amount you paid' })
    .positive('Amount paid must be more than 0'),
  location: z.string().trim().max(120).optional(),
  notes: z.string().trim().optional(),
});

export type FuelLogFormValues = z.infer<typeof fuelLogFormSchema>;
