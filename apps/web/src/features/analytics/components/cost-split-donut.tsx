import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ChartRange, ShareBar } from '@/components/shared/chart';
import { Figure } from '@/components/shared/figure';
import { Money } from '@/components/shared/money';
import { SectionHeader } from '@/components/shared/section-header';
import { Card } from '@/components/ui/card';

import { costSplitQueryOptions } from '../api/get-cost-split';
import { rangeToParams, type CostRangePreset } from '../utils/range-to-params';
import { SPEND_SERIES } from '../utils/spend-series';

type RangePreset = Extract<CostRangePreset, '30d' | '90d' | '1y' | 'all'>;

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '12 months' },
  { value: 'all', label: 'All time' },
];

type Props = {
  vehicleId?: string;
  defaultRange?: RangePreset;
};

/**
 * Where the money went: the range's total, then one bar split by category
 * with each part named, its amount and its share. A bar and a list read at a
 * glance on a phone, where a donut's slices had to be matched to a legend.
 */
export function CostSplitDonut({ vehicleId, defaultRange = '1y' }: Props) {
  const [range, setRange] = useState<RangePreset>(defaultRange);
  const params = useMemo(() => ({ ...rangeToParams(range), vehicleId }), [range, vehicleId]);
  const query = useQuery(costSplitQueryOptions(params));

  const shares = useMemo(() => {
    if (!query.data) return [];
    const buckets = query.data.buckets;
    return SPEND_SERIES.map((series) => ({ ...series, value: Number(buckets[series.key]) }));
  }, [query.data]);

  const total = query.data ? Number(query.data.buckets.total) : 0;
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? '';

  return (
    <Card className="flex min-w-0 flex-col gap-4" data-testid="cost-split-card">
      <SectionHeader as="h3" description="By category" title="Where the money went" />
      <ChartRange onChange={setRange} options={RANGE_OPTIONS} value={range} />
      {query.isLoading ? (
        <p className="text-body text-fg-3">Loading your spend…</p>
      ) : query.isError ? (
        <p className="text-body text-late">Your spend could not be loaded. Try again shortly.</p>
      ) : total <= 0 ? (
        <p className="text-body text-fg-2">No spend recorded in this range yet.</p>
      ) : (
        <>
          <Figure
            label={range === 'all' ? 'Spent in all' : `Spent, last ${rangeLabel.toLowerCase()}`}
            size="lg"
            value={<Money value={total} />}
          />
          <ShareBar label={`Spend by category, ${rangeLabel.toLowerCase()}`} shares={shares} />
        </>
      )}
    </Card>
  );
}
