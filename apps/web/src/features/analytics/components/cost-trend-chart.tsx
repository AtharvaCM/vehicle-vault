import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { costTrendQueryOptions, type CostTrendParams } from '../api/get-cost-trend';

type RangePreset = '6m' | '1y' | '2y' | 'all';

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: '6m', label: '6m' },
  { value: '1y', label: '1y' },
  { value: '2y', label: '2y' },
  { value: 'all', label: 'All' },
];

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function rangeToParams(range: RangePreset): CostTrendParams {
  if (range === 'all') return {};
  const to = new Date();
  const from = new Date(to);
  if (range === '6m') from.setMonth(from.getMonth() - 6);
  if (range === '1y') from.setFullYear(from.getFullYear() - 1);
  if (range === '2y') from.setFullYear(from.getFullYear() - 2);
  return { from: from.toISOString(), to: to.toISOString() };
}

type Mode = 'total' | 'costPerKm';

type Props = {
  vehicleId?: string;
  defaultRange?: RangePreset;
};

export function CostTrendChart({ vehicleId, defaultRange = '1y' }: Props) {
  const [range, setRange] = useState<RangePreset>(defaultRange);
  const [mode, setMode] = useState<Mode>('total');
  const params = useMemo(() => ({ ...rangeToParams(range), vehicleId }), [range, vehicleId]);
  const query = useQuery(costTrendQueryOptions(params));

  const chartData = useMemo(() => {
    if (!query.data) return [];
    return query.data.points.map((p) => ({
      period: p.period,
      total: Number(p.total),
      fuel: Number(p.fuel),
      maintenance: Number(p.maintenance),
      insurance: Number(p.insurance),
      loanInterest: Number(p.loanInterest),
      costPerKm: p.costPerKm ? Number(p.costPerKm) : null,
      km: p.km,
    }));
  }, [query.data]);

  const hasAnyData = chartData.some(
    (p) => p.total > 0 || (p.costPerKm !== null && p.costPerKm > 0),
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            Ownership trend
          </CardTitle>
          <CardDescription>
            {mode === 'total'
              ? 'Monthly spend by category'
              : 'Cost per kilometre driven'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={mode === 'total' ? 'default' : 'outline'}
              onClick={() => setMode('total')}
            >
              ₹/month
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'costPerKm' ? 'default' : 'outline'}
              onClick={() => setMode('costPerKm')}
            >
              ₹/km
            </Button>
          </div>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={range === option.value ? 'default' : 'outline'}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-slate-500">Loading trend…</p>
        ) : query.isError ? (
          <p className="text-sm text-red-600">Failed to load cost trend.</p>
        ) : !hasAnyData ? (
          <p className="text-sm text-slate-500">No spend recorded in this range yet.</p>
        ) : (
          <div className="h-72 w-full" data-testid="cost-trend-chart">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" fontSize={11} stroke="#64748b" />
                <YAxis
                  fontSize={11}
                  stroke="#64748b"
                  tickFormatter={(v: number) => inr.format(v)}
                  width={80}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const n = Number(value ?? 0);
                    return [inr.format(n), String(name)];
                  }}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {mode === 'total' ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey="fuel"
                      name="Fuel"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="maintenance"
                      name="Maintenance"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="insurance"
                      name="Insurance"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="loanInterest"
                      name="Loan interest"
                      stroke="#ec4899"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot
                    />
                  </>
                ) : (
                  <Line
                    type="monotone"
                    dataKey="costPerKm"
                    name="₹ / km"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
