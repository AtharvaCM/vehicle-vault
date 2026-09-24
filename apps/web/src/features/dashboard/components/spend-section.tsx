import { ChevronDown } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import { SectionHeader } from '@/components/shared/section-header';
import { CostSplitDonut } from '@/features/analytics/components/cost-split-donut';
import { CostTrendChart } from '@/features/analytics/components/cost-trend-chart';

import { useMediaQuery } from '../hooks/use-media-query';

function SpendCharts() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <CostSplitDonut />
      <CostTrendChart />
    </div>
  );
}

function SpendHeading() {
  return (
    <SectionHeader
      description="Where the money went, across all your vehicles."
      id="spend-heading"
      title="Spend"
    />
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
        className="group rounded-card border border-line bg-surface"
        onToggle={(event: SyntheticEvent<HTMLDetailsElement>) => setOpen(event.currentTarget.open)}
        open={open}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-body font-medium text-fg [&::-webkit-details-marker]:hidden">
          Show spending
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 text-fg-3 transition-transform group-open:rotate-180"
          />
        </summary>
        {open ? (
          <div className="border-t border-line-subtle p-4">
            <SpendCharts />
          </div>
        ) : null}
      </details>
    </section>
  );
}
