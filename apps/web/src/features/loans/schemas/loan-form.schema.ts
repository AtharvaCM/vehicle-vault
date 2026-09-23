import { z } from 'zod';

export const loanFormSchema = z.object({
  lender: z.string().trim().min(1, 'Lender is required').max(120),
  accountNumber: z.string().trim().max(80).optional(),
  principal: z
    .number({ invalid_type_error: 'Enter the loan amount' })
    .positive('Loan amount must be more than 0'),
  interestRate: z
    .number({ invalid_type_error: 'Enter the interest rate, or 0 for an interest-free loan' })
    .min(0, 'Rate must be 0 or greater')
    .max(100, 'Rate must be 100 or less'),
  tenureMonths: z
    .number({ invalid_type_error: 'Enter the tenure in months' })
    .int('Enter whole months')
    .positive('Tenure must be positive')
    .max(600, 'Max 600 months (50 years)'),
  startDate: z.string().min(1, 'Start date is required'),
  notes: z.string().trim().optional(),
});

export type LoanFormValues = z.infer<typeof loanFormSchema>;
