export const LoanStatus = {
  Active: 'active',
  Closed: 'closed',
} as const;

export type LoanStatus = (typeof LoanStatus)[keyof typeof LoanStatus];
