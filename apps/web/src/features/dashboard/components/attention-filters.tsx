import { Link } from '@tanstack/react-router';

import { cn } from '@/lib/utils';

import type { DashboardAttentionCounts } from '../types/dashboard';
import type { DashboardFocus } from '../types/dashboard-search';
import { attentionCount } from '../utils/attention-set';

const CHIP =
  'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-ui font-medium text-fg-2 transition-colors hover:border-brand hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const CHIP_ACTIVE = 'border-brand bg-brand-tint text-fg';

type AttentionFiltersProps = {
  counts: DashboardAttentionCounts;
  focus?: DashboardFocus;
};

/**
 * The queue's filters as one row of chips, each with its count: everything,
 * what is late, what is due this week, and papers running out. The choice is
 * the URL's `focus`, so a chip is a link and Back undoes it.
 */
export function AttentionFilters({ counts, focus }: AttentionFiltersProps) {
  const chips: { focus: DashboardFocus | undefined; label: string; count: number }[] = [
    { focus: undefined, label: 'All', count: attentionCount(counts) },
    { focus: 'overdue', label: 'Late', count: counts.overdue },
    { focus: 'week', label: 'This week', count: counts.today + counts.thisWeek },
    { focus: 'documents', label: 'Papers', count: counts.documentsExpiring30d },
  ];

  return (
    <nav
      aria-label="Filter what needs attention"
      className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-2">
        {chips.map((chip) => {
          const active = chip.focus === focus;

          return (
            <li key={chip.label}>
              <Link
                aria-current={active ? 'true' : undefined}
                className={cn(CHIP, active && CHIP_ACTIVE)}
                search={chip.focus ? { focus: chip.focus } : {}}
                to="/home"
              >
                {chip.label}
                <span className="tabular-nums text-fg-3">{chip.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
