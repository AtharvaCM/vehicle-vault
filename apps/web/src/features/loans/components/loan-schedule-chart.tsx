import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useLoanSchedule } from '../hooks/use-loan-schedule';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

type Props = {
  loanId: string;
};

export function LoanScheduleChart({ loanId }: Props) {
  const query = useLoanSchedule(loanId);

  const data = useMemo(() => {
    if (!query.data) return [];
    return query.data.map((point) => ({
      period: point.period,
      principal: point.principal,
      interest: point.interest,
      prepayment: point.prepayment,
      balance: point.balance,
    }));
  }, [query.data]);

  if (query.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading schedule…</p>;
  }
  if (query.isError) {
    return <p className="text-xs text-rose-600">Failed to load schedule.</p>;
  }
  if (!data.length) {
    return <p className="text-xs text-muted-foreground">No schedule yet.</p>;
  }

  return (
    <div className="h-64 w-full" data-testid="loan-schedule-chart">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" fontSize={10} stroke="#64748b" interval="preserveStartEnd" />
          <YAxis
            yAxisId="left"
            fontSize={10}
            stroke="#64748b"
            tickFormatter={(v: number) => inr.format(v)}
            width={70}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            fontSize={10}
            stroke="#64748b"
            tickFormatter={(v: number) => inr.format(v)}
            width={70}
          />
          <Tooltip
            formatter={(value, name) => [inr.format(Number(value ?? 0)), String(name)]}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="principal"
            name="Principal"
            stackId="emi"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.5}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="interest"
            name="Interest"
            stackId="emi"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.5}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="prepayment"
            name="Prepayment"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.35}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke="#0f172a"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
