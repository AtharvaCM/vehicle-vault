import { z } from 'zod';

import { LoanStatus } from '../enums/loan-status.enum';

export const VehicleLoanCreateSchema = z.object({
  lender: z.string().trim().min(1).max(120),
  accountNumber: z.string().trim().min(1).max(80).optional(),
  principal: z.number().positive(),
  // Annual nominal rate as percent (e.g. 8.75 → 8.75%/yr).
  interestRate: z.number().nonnegative().max(100),
  tenureMonths: z.number().int().positive().max(600),
  startDate: z.string().datetime(),
  currencyCode: z.string().length(3).optional(),
  notes: z.string().trim().min(1).optional(),
});

export const VehicleLoanUpdateSchema = VehicleLoanCreateSchema.partial()
  .extend({
    status: z.nativeEnum(LoanStatus).optional(),
    closedAt: z.string().datetime().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one loan field must be provided',
  });

export const AmortizationPointSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  emi: z.number(),
  principal: z.number(),
  interest: z.number(),
  prepayment: z.number(),
  balance: z.number(),
});

export const LoanPrepaymentCreateSchema = z.object({
  date: z.string().datetime(),
  amount: z.number().positive(),
  notes: z.string().trim().min(1).optional(),
});

export const LoanPrepaymentSchema = LoanPrepaymentCreateSchema.extend({
  id: z.string().uuid(),
  loanId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const LoanForecloseSchema = z.object({
  closedAt: z.string().datetime().optional(),
  notes: z.string().trim().min(1).optional(),
});

export const VehicleLoanSchema = VehicleLoanCreateSchema.extend({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  currencyCode: z.string().length(3),
  emiAmount: z.number(),
  status: z.nativeEnum(LoanStatus),
  closedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Derived fields (computed on read).
  totalInterest: z.number(),
  totalPayable: z.number(),
  monthsRemaining: z.number().int().nonnegative(),
  outstandingBalance: z.number().nonnegative(),
  interestPaidToDate: z.number().nonnegative(),
  principalPaidToDate: z.number().nonnegative(),
  prepaidToDate: z.number().nonnegative(),
  endDate: z.string().datetime(),
  prepayments: z.array(LoanPrepaymentSchema),
});

export type CreateVehicleLoanInput = z.infer<typeof VehicleLoanCreateSchema>;
export type UpdateVehicleLoanInput = z.infer<typeof VehicleLoanUpdateSchema>;
export type VehicleLoan = z.infer<typeof VehicleLoanSchema>;
export type AmortizationPoint = z.infer<typeof AmortizationPointSchema>;
export type CreateLoanPrepaymentInput = z.infer<typeof LoanPrepaymentCreateSchema>;
export type LoanPrepayment = z.infer<typeof LoanPrepaymentSchema>;
export type LoanForecloseInput = z.infer<typeof LoanForecloseSchema>;
