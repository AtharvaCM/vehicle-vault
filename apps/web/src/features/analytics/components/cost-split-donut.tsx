import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format } from '@/lib/format';

import { costSplitQueryOptions } from '../api/get-cost-split';
import { rangeToParams, type CostRangePreset } from '../utils/range-to-params';

type RangePreset = Extract<CostRangePreset, '30d' | '90d' | '1y' | 'all'>;

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '12 months' },
  { value: 'all', label: 'All time' },
];

const BUCKET_COLORS: Record<string, string> = {
  Fuel: '#f59e0b',
  Maintenance: '#0f172a',
  Accessories: '#0ea5e9',
  Insurance: '#10b981',
  'Loan interest': '#f43f5e',
};

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
      { name: 'Accessories', value: Number(b.accessories) },
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
            <PieIcon className="h-4 w-4 text-fg-3" />
            Cost split
          </CardTitle>
          <CardDescription>Where your money went</CardDescription>
        </div>
        <ToggleGroup
          aria-label="Range"
          onValueChange={(value) => {
            if (value) setRange(value as RangePreset);
          }}
          type="single"
          value={range}
        >
          {RANGE_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-fg-3">Loading analytics…</p>
        ) : query.isError ? (
          <p className="text-sm text-late">Failed to load cost split.</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-fg-3">No spend recorded in this range yet.</p>
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
                    formatter={(value) => format.money(Number(value ?? 0))}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm font-medium text-fg-2">
              Total: {format.money(total)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
