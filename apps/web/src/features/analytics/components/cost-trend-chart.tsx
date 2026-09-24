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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format } from '@/lib/format';

import { costTrendQueryOptions } from '../api/get-cost-trend';
import { rangeToParams, type CostRangePreset } from '../utils/range-to-params';

type RangePreset = Extract<CostRangePreset, '6m' | '1y' | '2y' | 'all'>;

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: '6m', label: '6 months' },
  { value: '1y', label: '12 months' },
  { value: '2y', label: '2 years' },
  { value: 'all', label: 'All time' },
];

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
      accessories: Number(p.accessories),
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
            <TrendingUp className="h-4 w-4 text-fg-3" />
            Ownership trend
          </CardTitle>
          <CardDescription>
            {mode === 'total' ? 'Monthly spend by category' : 'Cost per kilometre driven'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <ToggleGroup
            aria-label="Value shown"
            onValueChange={(value) => {
              if (value) setMode(value as Mode);
            }}
            type="single"
            value={mode}
          >
            <ToggleGroupItem value="total">₹/month</ToggleGroupItem>
            <ToggleGroupItem value="costPerKm">₹/km</ToggleGroupItem>
          </ToggleGroup>
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
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-fg-3">Loading trend…</p>
        ) : query.isError ? (
          <p className="text-sm text-late">Failed to load cost trend.</p>
        ) : !hasAnyData ? (
          <p className="text-sm text-fg-3">No spend recorded in this range yet.</p>
        ) : (
          <div className="h-72 w-full" data-testid="cost-trend-chart">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" fontSize={11} stroke="#64748b" />
                <YAxis
                  fontSize={11}
                  stroke="#64748b"
                  tickFormatter={(v: number) => format.money(v)}
                  width={80}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const n = Number(value ?? 0);
                    return [format.money(n), String(name)];
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
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="accessories"
                      name="Accessories"
                      stroke="#0ea5e9"
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
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="#64748b"
                      strokeDasharray="4 4"
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
