import { z } from 'zod';

export const WarrantySchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  provider: z.string().min(1, 'Provider is required').max(120),
  warrantyNumber: z.string().max(80).optional().nullable(),
  type: z.string().min(1, 'Type is required').max(60), // manufacturer, extended, parts
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  endOdometer: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Warranty = z.infer<typeof WarrantySchema>;

export const CreateWarrantySchema = WarrantySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateWarrantyInput = z.infer<typeof CreateWarrantySchema>;

export const UpdateWarrantySchema = CreateWarrantySchema.partial();

export type UpdateWarrantyInput = z.infer<typeof UpdateWarrantySchema>;
