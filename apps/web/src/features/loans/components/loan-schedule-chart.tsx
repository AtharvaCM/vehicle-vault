import { useMemo } from 'react';

import { Chart } from '@/components/shared/chart';

import { useLoanSchedule } from '../hooks/use-loan-schedule';

type Props = {
  loanId: string;
};

/**
 * The schedule as two charts on one scale each, never one chart with two
 * y-axes: what each month's EMI pays (principal, interest, any prepayment,
 * stacked), then the balance left, which holds between EMIs and drops at each,
 * so it is drawn as steps.
 */
export function LoanScheduleChart({ loanId }: Props) {
  const query = useLoanSchedule(loanId);

  const data = useMemo(
    () =>
      (query.data ?? []).map((point) => ({
        period: point.period,
        principal: point.principal,
        interest: point.interest,
        prepayment: point.prepayment,
        balance: point.balance,
      })),
    [query.data],
  );
  const hasPrepayment = data.some((point) => point.prepayment > 0);

  if (query.isLoading) {
    return <p className="text-small text-fg-3">Loading the schedule…</p>;
  }
  if (query.isError) {
    return <p className="text-small text-late">The schedule could not be loaded.</p>;
  }
  if (!data.length) {
    return <p className="text-small text-fg-2">No schedule yet.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="loan-schedule-chart">
      <section className="flex min-w-0 flex-col gap-2">
        <h4 className="text-body font-semibold text-fg">What each EMI pays</h4>
        <Chart
          data={data}
          form="stacked"
          height={200}
          label="What each EMI pays, by month"
          series={[
            { key: 'principal', label: 'Principal', slot: 1 },
            { key: 'interest', label: 'Interest', slot: 2 },
            ...(hasPrepayment
              ? [{ key: 'prepayment' as const, label: 'Prepayment', slot: 3 as const }]
              : []),
          ]}
          xKey="period"
        />
      </section>
      <section className="flex min-w-0 flex-col gap-2">
        <h4 className="text-body font-semibold text-fg">Balance left</h4>
        <Chart
          data={data}
          form="step"
          height={180}
          label="Balance left after each EMI"
          series={[{ key: 'balance', label: 'Balance', slot: 3 }]}
          xKey="period"
        />
      </section>
    </div>
  );
}
