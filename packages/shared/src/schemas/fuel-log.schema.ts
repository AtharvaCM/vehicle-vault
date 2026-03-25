import { z } from 'zod';

export const FuelLogCreateSchema = z.object({
  date: z.string().datetime(),
  odometer: z.number().int().nonnegative(),
  quantity: z.number().positive(),
  price: z.number().positive(),
  totalCost: z.number().positive(),
  location: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().min(1).optional(),
});

export const FuelLogUpdateSchema = FuelLogCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: 'At least one fuel log field must be provided',
  },
);

export const FuelLogSchema = FuelLogCreateSchema.extend({
  id: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateFuelLogInput = z.infer<typeof FuelLogCreateSchema>;
export type UpdateFuelLogInput = z.infer<typeof FuelLogUpdateSchema>;
export type FuelLog = z.infer<typeof FuelLogSchema>;
