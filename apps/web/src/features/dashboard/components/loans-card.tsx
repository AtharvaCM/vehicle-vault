import { Link } from '@tanstack/react-router';

import { SectionCard } from '@/components/shared/section-card';
import { buttonVariants } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { DashboardLoanSummary } from '../types/dashboard';
import { calendarDaysUntil, formatRelativeDue } from '../utils/format-due';

type LoansCardProps = {
  loans: DashboardLoanSummary;
  today?: Date;
};

export function LoansCard({ loans, today = new Date() }: LoansCardProps) {
  if (loans.activeCount <= 0) {
    return null;
  }

  const nextEmiHint = loans.nextEmiDate
    ? `${formatDate(loans.nextEmiDate)} · ${formatRelativeDue({
        kind: 'loan_emi',
        dueDate: loans.nextEmiDate,
        daysUntilDue: calendarDaysUntil(loans.nextEmiDate, today),
      })}`
    : undefined;

  const tiles: Array<{ label: string; value: string; hint?: string }> = [
    { label: 'Next EMI', value: formatCurrency(loans.monthlyEmi), hint: nextEmiHint },
    { label: 'Outstanding', value: formatCurrency(loans.outstandingBalance) },
    {
      label: 'Interest paid',
      value: formatCurrency(loans.interestPaidToDate),
      hint: loans.prepaidToDate > 0 ? `Prepaid ${formatCurrency(loans.prepaidToDate)}` : undefined,
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
          <div className="rounded-md border border-slate-100 bg-white p-4" key={tile.label}>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{tile.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {tile.value}
            </div>
            {tile.hint ? <div className="mt-0.5 text-[12px] text-slate-500">{tile.hint}</div> : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
