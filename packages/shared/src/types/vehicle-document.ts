import { z } from 'zod';

export const VehicleDocumentKindSchema = z.enum(['insurance', 'warranty']);
export type VehicleDocumentKind = z.infer<typeof VehicleDocumentKindSchema>;

/**
 * Unified read shape for any kind of vehicle document. `details` carries
 * kind-specific fields (e.g. `premiumAmount` for insurance, `endOdometer`
 * for warranty) so callers that care can introspect, while shared fields
 * (provider, validity window, notes) stay flat for ergonomic consumers.
 */
export const VehicleDocumentSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  kind: VehicleDocumentKindSchema,
  provider: z.string().min(1).max(120),
  number: z.string().min(1).max(80).nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  notes: z.string().max(500).nullable(),
  details: z.record(z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type VehicleDocument = z.infer<typeof VehicleDocumentSchema>;

const InsuranceFieldsSchema = z.object({
  provider: z.string().min(1, 'Provider is required').max(120),
  policyNumber: z.string().min(1, 'Policy number is required').max(80),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  premiumAmount: z.number().min(0).optional().nullable(),
  insuredValue: z.number().min(0).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const WarrantyFieldsSchema = z.object({
  provider: z.string().min(1, 'Provider is required').max(120),
  warrantyNumber: z.string().max(80).optional().nullable(),
  type: z.string().min(1, 'Type is required').max(60),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  endOdometer: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const CreateVehicleDocumentSchema = z.discriminatedUnion('kind', [
  InsuranceFieldsSchema.extend({ kind: z.literal('insurance') }),
  WarrantyFieldsSchema.extend({ kind: z.literal('warranty') }),
]);

export type CreateVehicleDocumentInput = z.infer<typeof CreateVehicleDocumentSchema>;

export const UpdateVehicleDocumentSchema = z.discriminatedUnion('kind', [
  InsuranceFieldsSchema.partial().extend({ kind: z.literal('insurance') }),
  WarrantyFieldsSchema.partial().extend({ kind: z.literal('warranty') }),
]);

export type UpdateVehicleDocumentInput = z.infer<typeof UpdateVehicleDocumentSchema>;
