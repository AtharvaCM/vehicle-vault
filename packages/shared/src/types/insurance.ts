import { z } from 'zod';

export const InsurancePolicySchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  provider: z.string().min(1, 'Provider is required').max(120),
  policyNumber: z.string().min(1, 'Policy number is required').max(80),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  premiumAmount: z.number().min(0).optional().nullable(),
  insuredValue: z.number().min(0).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type InsurancePolicy = z.infer<typeof InsurancePolicySchema>;

export const CreateInsurancePolicySchema = InsurancePolicySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateInsurancePolicyInput = z.infer<typeof CreateInsurancePolicySchema>;

export const UpdateInsurancePolicySchema = CreateInsurancePolicySchema.partial();

export type UpdateInsurancePolicyInput = z.infer<typeof UpdateInsurancePolicySchema>;
