import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Chart, ChartRange } from '@/components/shared/chart';
import { SectionHeader } from '@/components/shared/section-header';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format } from '@/lib/format';

import { costTrendQueryOptions } from '../api/get-cost-trend';
import { rangeToParams, type CostRangePreset } from '../utils/range-to-params';
import { SPEND_SERIES } from '../utils/spend-series';

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

const perKm = (value: number) => `${format.money(value, { decimals: 2 })}/km`;

/**
 * Spend per month as stacked bars, one colour per category, the bar's height
 * the month's total; or the cost of each kilometre driven that month. Months
 * are totals, so they are bars: a line would claim values between them.
 */
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
    }));
  }, [query.data]);

  // Only the categories this range has any spend in: an empty one would be a
  // legend entry for nothing. Each keeps its own colour either way.
  const series = useMemo(
    () => SPEND_SERIES.filter((item) => chartData.some((point) => point[item.key] !== 0)),
    [chartData],
  );
  const hasAnyData =
    mode === 'total'
      ? chartData.some((p) => p.total > 0)
      : chartData.some((p) => p.costPerKm !== null && p.costPerKm > 0);

  return (
    <Card className="flex min-w-0 flex-col gap-4" data-testid="cost-trend-card">
      <SectionHeader
        as="h3"
        description={
          mode === 'total' ? 'Spend each month, by category' : 'What each kilometre driven cost'
        }
        title="Monthly spend"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <ToggleGroup
          aria-label="Show"
          className="flex w-full sm:inline-flex sm:w-auto"
          onValueChange={(value) => {
            if (value) setMode(value as Mode);
          }}
          type="single"
          value={mode}
        >
          <ToggleGroupItem className="flex-1 sm:flex-none" value="total">
            Per month
          </ToggleGroupItem>
          <ToggleGroupItem className="flex-1 sm:flex-none" value="costPerKm">
            Per km
          </ToggleGroupItem>
        </ToggleGroup>
        <ChartRange onChange={setRange} options={RANGE_OPTIONS} value={range} />
      </div>
      {query.isLoading ? (
        <p className="text-body text-fg-3">Loading your spend…</p>
      ) : query.isError ? (
        <p className="text-body text-late">Your spend could not be loaded. Try again shortly.</p>
      ) : !hasAnyData ? (
        <p className="text-body text-fg-2">
          {mode === 'total'
            ? 'No spend recorded in this range yet.'
            : 'Log fuel with odometer readings to see what each kilometre costs.'}
        </p>
      ) : mode === 'total' ? (
        <Chart
          data={chartData}
          form="stacked"
          label="Spend each month, by category"
          series={series}
          xKey="period"
        />
      ) : (
        <Chart
          data={chartData}
          form="bar"
          label="Cost per kilometre, each month"
          series={[{ key: 'costPerKm', label: 'Cost per km', slot: 1 }]}
          axisFormat={(value) => format.money(value)}
          valueFormat={perKm}
          xKey="period"
        />
      )}
    </Card>
  );
}
