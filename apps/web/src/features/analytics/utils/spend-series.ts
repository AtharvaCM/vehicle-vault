import type { ChartSeries, ChartSlot } from '@/components/shared/chart';

export type SpendCategory = 'maintenance' | 'fuel' | 'insurance' | 'accessories' | 'loanInterest';

/**
 * Where the money goes, each category in its own chart slot for good: Service
 * is always the first colour, Fuel the second, whatever else a range shows.
 * The order is also the stacking order the palette was validated in.
 */
export const SPEND_SERIES: ChartSeries<SpendCategory>[] = [
  { key: 'maintenance', label: 'Service', slot: 1 },
  { key: 'fuel', label: 'Fuel', slot: 2 },
  { key: 'insurance', label: 'Insurance', slot: 3 },
  { key: 'accessories', label: 'Accessories', slot: 4 },
  { key: 'loanInterest', label: 'Loan interest', slot: 5 },
];

export const SPEND_SLOT: Record<SpendCategory, ChartSlot> = Object.fromEntries(
  SPEND_SERIES.map((series) => [series.key, series.slot]),
) as Record<SpendCategory, ChartSlot>;
