import type { ReactNode } from 'react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { PapersAttention } from '@/features/vehicle-documents/utils/papers-attention';

import type { VehicleDetailTab } from '../types/vehicle-detail-search';

type VehicleTabListProps = {
  /** Whether any paper has expired or runs out within 30 days: a dot on Papers. */
  papers: PapersAttention | null;
};

/**
 * The vehicle page's five destinations as underline tabs along the header's
 * bottom edge. Five short labels fit a 390px phone without scrolling, which is
 * the point of having five.
 */
export function VehicleTabList({ papers }: VehicleTabListProps) {
  return (
    <TabsList
      aria-label="Vehicle sections"
      className="-mx-2 -mb-px flex h-auto justify-start gap-0 rounded-none bg-transparent p-0 sm:-mx-3"
    >
      <VehicleTab value="overview">Overview</VehicleTab>
      <VehicleTab value="history">History</VehicleTab>
      <VehicleTab value="reminders">Reminders</VehicleTab>
      {/* The label says in words what the dot says in colour. An sr-only span would be
          absolutely positioned, and Chrome names the tab "Papers , 1 paper expired". */}
      <VehicleTab aria-label={papers?.label ? `Papers, ${papers.label}` : undefined} value="papers">
        Papers
        {papers?.tone ? (
          <span
            aria-hidden="true"
            className={cn(
              'size-[7px] rounded-full',
              papers.tone === 'late' ? 'bg-late' : 'bg-soon-dot',
            )}
            data-testid="papers-status-dot"
            data-tone={papers.tone}
          />
        ) : null}
      </VehicleTab>
      <VehicleTab value="more">More</VehicleTab>
    </TabsList>
  );
}

function VehicleTab({
  value,
  children,
  'aria-label': ariaLabel,
}: {
  value: VehicleDetailTab;
  children: ReactNode;
  'aria-label'?: string;
}) {
  return (
    <TabsTrigger
      aria-label={ariaLabel}
      className="h-11 rounded-none border-b-2 border-transparent px-2 text-ui font-medium text-fg-2 hover:text-fg data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-brand data-[state=active]:ring-0 sm:px-3 md:h-11"
      value={value}
    >
      {children}
    </TabsTrigger>
  );
}
