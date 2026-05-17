import { z } from 'zod';

export const ClaimStatusSchema = z.enum(['filed', 'approved', 'settled', 'rejected']);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

/**
 * An insurance claim filed against an {@link InsurancePolicy} for a single
 * repair event. Optionally linked to the {@link MaintenanceRecord} that
 * documents the work — nullable so the claim can be opened before the bill
 * arrives, then backfilled.
 *
 * `outOfPocket` is derived (`grossAmount - insurerPaidAmount`); we don't
 * persist it.
 */
export const ClaimSchema = z.object({
  id: z.string().uuid(),
  insurancePolicyId: z.string().uuid(),
  maintenanceRecordId: z.string().uuid().nullable(),
  claimNumber: z.string().max(120).nullable(),
  grossAmount: z.number().nonnegative(),
  insurerPaidAmount: z.number().nonnegative(),
  status: ClaimStatusSchema,
  filedDate: z.coerce.date(),
  settledDate: z.coerce.date().nullable(),
  notes: z.string().max(2000).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Claim = z.infer<typeof ClaimSchema>;

export const CreateClaimSchema = z
  .object({
    insurancePolicyId: z.string().uuid(),
    maintenanceRecordId: z.string().uuid().optional().nullable(),
    claimNumber: z.string().max(120).optional().nullable(),
    grossAmount: z.number().nonnegative(),
    insurerPaidAmount: z.number().nonnegative(),
    status: ClaimStatusSchema.default('filed'),
    filedDate: z.coerce.date(),
    settledDate: z.coerce.date().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine((value) => value.insurerPaidAmount <= value.grossAmount, {
    message: 'Insurer paid amount cannot exceed gross amount.',
    path: ['insurerPaidAmount'],
  })
  .refine(
    (value) => value.status !== 'settled' || value.settledDate !== undefined,
    {
      message: 'Settled claims must have a settledDate.',
      path: ['settledDate'],
    },
  );

export type CreateClaimInput = z.infer<typeof CreateClaimSchema>;

export const UpdateClaimSchema = z
  .object({
    maintenanceRecordId: z.string().uuid().optional().nullable(),
    claimNumber: z.string().max(120).optional().nullable(),
    grossAmount: z.number().nonnegative().optional(),
    insurerPaidAmount: z.number().nonnegative().optional(),
    status: ClaimStatusSchema.optional(),
    filedDate: z.coerce.date().optional(),
    settledDate: z.coerce.date().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (value) => {
      if (value.grossAmount === undefined || value.insurerPaidAmount === undefined) return true;
      return value.insurerPaidAmount <= value.grossAmount;
    },
    {
      message: 'Insurer paid amount cannot exceed gross amount.',
      path: ['insurerPaidAmount'],
    },
  );

export type UpdateClaimInput = z.infer<typeof UpdateClaimSchema>;

export function outOfPocket(claim: Pick<Claim, 'grossAmount' | 'insurerPaidAmount'>): number {
  return Math.max(0, claim.grossAmount - claim.insurerPaidAmount);
}
