import { z } from 'zod';

/**
 * An empty number input reaches the schema as NaN, which is a type error, so
 * each number's "missing" message is its `error`: the friendly
 * range messages below only ever see a real number.
 *
 * `totalCost`, `quantity` and `odometer` are the three fields the dialog puts
 * up front; everything else, including `price` (computed from the two above,
 * but still editable), sits under "More details".
 */
export const fuelLogFormSchema = z.object({
  totalCost: z
    .number({ error: 'Enter the amount you paid' })
    .positive('Amount paid must be more than 0'),
  quantity: z.number({ error: 'Enter the quantity' }).positive('Quantity must be more than 0'),
  odometer: z
    .number({ error: 'Enter the odometer reading' })
    .int('Enter the reading in whole kilometres')
    .nonnegative('Odometer cannot be negative'),
  isFullTank: z.boolean().optional(),
  date: z.string().min(1, 'Enter the date of the fill'),
  price: z
    .number({ error: 'Enter the price per unit' })
    .positive('Price per unit must be more than 0'),
  location: z.string().trim().max(120).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  notes: z.string().trim().optional(),
});

export type FuelLogFormValues = z.infer<typeof fuelLogFormSchema>;
