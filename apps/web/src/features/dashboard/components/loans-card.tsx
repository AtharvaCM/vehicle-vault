import { Link } from '@tanstack/react-router';

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

  const tiles: Array<{ label: string; value: string; hint?: string }> = [
    { label: 'Next EMI', value: format.money(loans.monthlyEmi), hint: nextEmiHint },
    { label: 'Outstanding', value: format.money(loans.outstandingBalance) },
    {
      label: 'Interest paid',
      value: format.money(loans.interestPaidToDate),
      hint: loans.prepaidToDate > 0 ? `Prepaid ${format.money(loans.prepaidToDate)}` : undefined,
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
            {tile.hint ? (
              <div className="mt-0.5 text-[12px] text-slate-500">{tile.hint}</div>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
