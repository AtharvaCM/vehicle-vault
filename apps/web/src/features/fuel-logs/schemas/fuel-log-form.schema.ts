import { z } from 'zod';

export const fuelLogFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  odometer: z.number().int().nonnegative('Odometer must be non-negative'),
  quantity: z.number().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive'),
  totalCost: z.number().positive('Total cost must be positive'),
  location: z.string().trim().max(120).optional(),
  notes: z.string().trim().optional(),
});

export type FuelLogFormValues = z.infer<typeof fuelLogFormSchema>;
