import { CheckCircle2 } from 'lucide-react';

import type { DashboardAttentionItem } from '../types/dashboard';
import { formatRelativeDue } from '../utils/format-due';

type AllClearPanelProps = {
  /** The first item due in the next 30 days, if any. */
  next: DashboardAttentionItem | undefined;
  showVehicle: boolean;
};

/**
 * Home when nothing is late or due this week: one large "All clear" and what
 * comes next, so the daily visit takes a second.
 */
export function AllClearPanel({ next, showVehicle }: AllClearPanelProps) {
  return (
    <section
      aria-label="All clear"
      className="flex items-center gap-4 rounded-card border border-ok/30 bg-ok-tint px-5 py-6"
      data-testid="all-clear"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ok">
        <CheckCircle2 aria-hidden="true" className="size-7" />
      </div>
      <div className="min-w-0">
        <p className="text-title font-semibold tracking-tight text-fg">All clear.</p>
        <p className="text-body text-fg-2">
          {next
            ? `Next: ${next.title} · ${formatRelativeDue(next)}${showVehicle ? ` · ${next.vehicleName}` : ''}`
            : 'Nothing due in the next 30 days.'}
        </p>
      </div>
    </section>
  );
}
