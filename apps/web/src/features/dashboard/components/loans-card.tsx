import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { Figure } from '@/components/shared/figure';
import { Money } from '@/components/shared/money';
import { SectionCard } from '@/components/shared/section-card';
import { buttonVariants } from '@/components/ui/button';
import { format } from '@/lib/format';

import type { DashboardLoanSummary } from '../types/dashboard';
import { formatRelativeDue } from '../utils/format-due';

type LoansCardProps = {
  loans: DashboardLoanSummary;
  today?: Date;
};

export function LoansCard({ loans, today = new Date() }: LoansCardProps) {
  if (loans.activeCount <= 0) {
    return null;
  }

  const nextEmiHint = loans.nextEmiDate
    ? `${format.date(loans.nextEmiDate)} · ${formatRelativeDue({
        kind: 'loan_emi',
        dueDate: loans.nextEmiDate,
        daysUntilDue: format.daysUntil(loans.nextEmiDate, today),
      })}`
    : undefined;

  const tiles: Array<{ label: string; value: number; hint?: ReactNode }> = [
    { label: 'Next EMI', value: loans.monthlyEmi, hint: nextEmiHint },
    { label: 'Outstanding', value: loans.outstandingBalance },
    {
      label: 'Interest paid',
      value: loans.interestPaidToDate,
      hint:
        loans.prepaidToDate > 0 ? (
          <>
            Prepaid <Money value={loans.prepaidToDate} />
          </>
        ) : undefined,
    },
  ];

  return (
    <SectionCard
      action={
        <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/loans">
          Manage
        </Link>
      }
      description={`${loans.activeCount} active loan${loans.activeCount === 1 ? '' : 's'}`}
      title="Vehicle loans"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div className="rounded-card border border-line bg-surface p-4" key={tile.label}>
            <Figure hint={tile.hint} label={tile.label} value={<Money value={tile.value} />} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
