import { ChevronDown } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import { CostSplitDonut } from '@/features/analytics/components/cost-split-donut';
import { CostTrendChart } from '@/features/analytics/components/cost-trend-chart';

import { useMediaQuery } from '../hooks/use-media-query';

function SpendCharts() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CostSplitDonut />
      <CostTrendChart />
    </div>
  );
}

function SpendHeading() {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight" id="spend-heading">
        Spend
      </h2>
      <p className="text-[13px] text-slate-500">Where the money went across all vehicles.</p>
    </div>
  );
}

/**
 * Charts are heavy and analytical, so on phones they sit behind a native
 * `<details>` and only mount once opened — recharts measures its container on
 * mount, and a `display:none` container measures as 0×0.
 */
export function SpendSection() {
  const isDesktop = useMediaQuery('(min-width: 640px)');
  const [open, setOpen] = useState(false);

  if (isDesktop) {
    return (
      <section aria-labelledby="spend-heading" className="space-y-3">
        <SpendHeading />
        <SpendCharts />
      </section>
    );
  }

  return (
    <section aria-labelledby="spend-heading" className="space-y-3">
      <SpendHeading />
      <details
        className="group rounded-xl border border-slate-200/60 bg-white/70 shadow-premium-sm"
        onToggle={(event: SyntheticEvent<HTMLDetailsElement>) =>
          setOpen(event.currentTarget.open)
        }
        open={open}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">
          Show spending
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
          />
        </summary>
        {open ? (
          <div className="border-t border-slate-100 p-4">
            <SpendCharts />
          </div>
        ) : null}
      </details>
    </section>
  );
}
