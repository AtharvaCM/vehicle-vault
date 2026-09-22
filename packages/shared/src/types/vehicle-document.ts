import { z } from 'zod';

import { FuelType } from '../enums';

export const VehicleDocumentKindSchema = z.enum([
  'insurance',
  'warranty',
  'registration',
  'puc',
  'road_tax',
]);
export type VehicleDocumentKind = z.infer<typeof VehicleDocumentKindSchema>;

/**
 * The simple compliance kinds (registration certificate, PUC certificate,
 * road tax) share one field shape and one storage table, unlike insurance
 * and warranty which each have dedicated tables.
 */
export const complianceDocumentKinds = ['registration', 'puc', 'road_tax'] as const;
export type ComplianceDocumentKind = (typeof complianceDocumentKinds)[number];

/**
 * Whether the law asks this vehicle for a PUC (Pollution Under Control)
 * certificate. The test measures what comes out of a tailpipe, so an electric
 * vehicle, which has none, is exempt and nothing should ask it for one; a
 * hybrid still burns fuel and is not. This decides only whether a PUC is
 * expected: one already on file is tracked like any other document.
 */
export function requiresPuc(fuelType: FuelType): boolean {
  return fuelType !== FuelType.Electric;
}

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
  // Null where the document is known only by its expiry: the new-vehicle
  // prompt collects that alone, and scanning or editing fills the rest in.
  provider: z.string().min(1).max(120).nullable(),
  number: z.string().min(1).max(80).nullable(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  notes: z.string().max(500).nullable(),
  details: z.record(z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type VehicleDocument = z.infer<typeof VehicleDocumentSchema>;

/**
 * A text or date input the user never touched arrives as '', which means "not
 * recorded" rather than "a name of length zero" or an invalid date. Written as
 * a transform rather than `z.preprocess` so the schema keeps a typed input,
 * which the form resolver on the web needs.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? undefined : value))
    .optional()
    .nullable();

const optionalDate = z
  .union([z.literal(''), z.coerce.date()])
  .transform((value) => (value === '' ? undefined : value))
  .optional()
  .nullable();

/**
 * Insurance and the compliance kinds are both reachable from the prompt a new
 * vehicle lands on, which asks for an expiry and nothing else. So the expiry is
 * the only field either one insists on; the insurer, the number and the start
 * date are all filled in later, by a scan or by an edit.
 */
const InsuranceFieldsSchema = z.object({
  provider: optionalText(120),
  policyNumber: optionalText(80),
  startDate: optionalDate,
  endDate: z.coerce.date(),
  premiumAmount: z.number().min(0).optional().nullable(),
  insuredValue: z.number().min(0).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const WarrantyFieldsSchema = z.object({
  provider: z.string().min(1, 'Provider is required').max(120),
  warrantyNumber: optionalText(80),
  type: z.string().min(1, 'Type is required').max(60),
  startDate: z.coerce.date(),
  endDate: optionalDate,
  endOdometer: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

const ComplianceFieldsSchema = z.object({
  provider: optionalText(120),
  number: optionalText(80),
  startDate: optionalDate,
  endDate: optionalDate,
  amount: z.number().min(0).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

/**
 * A compliance document with neither date is not a record of anything, so one
 * of the two is still required even though each is individually optional.
 * Insurance needs no such check: its expiry is required outright.
 */
function requireADate(
  value: { kind: VehicleDocumentKind; startDate?: Date | null; endDate?: Date | null },
  ctx: z.RefinementCtx,
) {
  if (value.kind === 'insurance' || value.kind === 'warranty') return;
  if (value.startDate || value.endDate) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['endDate'],
    message: 'Add an expiry date, or the date it was issued',
  });
}

export const CreateVehicleDocumentSchema = z
  .discriminatedUnion('kind', [
    InsuranceFieldsSchema.extend({ kind: z.literal('insurance') }),
    WarrantyFieldsSchema.extend({ kind: z.literal('warranty') }),
    ComplianceFieldsSchema.extend({ kind: z.literal('registration') }),
    ComplianceFieldsSchema.extend({ kind: z.literal('puc') }),
    ComplianceFieldsSchema.extend({ kind: z.literal('road_tax') }),
  ])
  .superRefine(requireADate);

export type CreateVehicleDocumentInput = z.infer<typeof CreateVehicleDocumentSchema>;

export const UpdateVehicleDocumentSchema = z.discriminatedUnion('kind', [
  InsuranceFieldsSchema.partial().extend({ kind: z.literal('insurance') }),
  WarrantyFieldsSchema.partial().extend({ kind: z.literal('warranty') }),
  ComplianceFieldsSchema.partial().extend({ kind: z.literal('registration') }),
  ComplianceFieldsSchema.partial().extend({ kind: z.literal('puc') }),
  ComplianceFieldsSchema.partial().extend({ kind: z.literal('road_tax') }),
]);

export type UpdateVehicleDocumentInput = z.infer<typeof UpdateVehicleDocumentSchema>;
