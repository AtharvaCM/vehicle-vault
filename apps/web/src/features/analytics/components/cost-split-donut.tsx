import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { costSplitQueryOptions, type CostSplitParams } from '../api/get-cost-split';

type RangePreset = '30d' | '90d' | '1y' | 'all';

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: '1y', label: '1y' },
  { value: 'all', label: 'All' },
];

const BUCKET_COLORS: Record<string, string> = {
  Fuel: '#f59e0b',
  Maintenance: '#6366f1',
  Insurance: '#10b981',
  'Loan interest': '#ec4899',
};

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function rangeToParams(range: RangePreset): CostSplitParams {
  if (range === 'all') return {};
  const to = new Date();
  const from = new Date(to);
  if (range === '30d') from.setDate(from.getDate() - 30);
  if (range === '90d') from.setDate(from.getDate() - 90);
  if (range === '1y') from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

type Props = {
  vehicleId?: string;
  defaultRange?: RangePreset;
};

export function CostSplitDonut({ vehicleId, defaultRange = '1y' }: Props) {
  const [range, setRange] = useState<RangePreset>(defaultRange);
  const params = useMemo(() => ({ ...rangeToParams(range), vehicleId }), [range, vehicleId]);
  const query = useQuery(costSplitQueryOptions(params));

  const chartData = useMemo(() => {
    if (!query.data) return [];
    const b = query.data.buckets;
    return [
      { name: 'Fuel', value: Number(b.fuel) },
      { name: 'Maintenance', value: Number(b.maintenance) },
      { name: 'Insurance', value: Number(b.insurance) },
      { name: 'Loan interest', value: Number(b.loanInterest) },
    ].filter((d) => d.value > 0);
  }, [query.data]);

  const total = query.data ? Number(query.data.buckets.total) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <PieIcon className="h-4 w-4 text-indigo-600" />
            Cost split
          </CardTitle>
          <CardDescription>Where your money went</CardDescription>
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
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-slate-500">Loading analytics…</p>
        ) : query.isError ? (
          <p className="text-sm text-red-600">Failed to load cost split.</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-slate-500">No spend recorded in this range yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="h-64 w-full" data-testid="cost-split-chart">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={BUCKET_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => inrFormatter.format(Number(value ?? 0))}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm font-medium text-slate-700">
              Total: {inrFormatter.format(total)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
