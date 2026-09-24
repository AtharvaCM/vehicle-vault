import { Link } from '@tanstack/react-router';
import { BellRing, CircleDot, Coins, History, Package, ShieldCheck } from 'lucide-react';
import { ReminderStatus } from '@vehicle-vault/shared';

import { SectionHeader } from '@/components/shared/section-header';
import { buttonVariants } from '@/components/ui/button';
import { format } from '@/lib/format';

import type { DashboardAttentionItem, DashboardAttentionKind } from '../types/dashboard';
import { formatRelativeDue } from '../utils/format-due';
import { AttentionItemLink } from './attention-row';

const KIND_ICONS: Record<DashboardAttentionKind, typeof BellRing> = {
  reminder: BellRing,
  document: ShieldCheck,
  loan_emi: Coins,
  tyre: CircleDot,
  service_baseline: History,
  accessory: Package,
};

type ComingUpListProps = {
  items: DashboardAttentionItem[];
  showVehicle: boolean;
};

export function ComingUpList({ items, showVehicle }: ComingUpListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="coming-up-heading" className="space-y-2">
      <SectionHeader description="Next 30 days" id="coming-up-heading" title="Coming up" />
      <div className="divide-y divide-line-subtle rounded-xl border border-line/60 bg-surface/70">
        {items.map((item) => {
          const Icon = KIND_ICONS[item.kind];

          return (
            <AttentionItemLink
              className="group flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              item={item}
              key={item.id}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-fg-3" />
              <span className="min-w-0 truncate font-medium text-fg transition-colors group-hover:text-primary">
                {item.title}
              </span>
              {showVehicle ? (
                <span className="min-w-0 truncate text-small text-fg-3">{item.vehicleName}</span>
              ) : null}
              <span className="ml-auto shrink-0 text-small tabular-nums text-fg-3">
                {formatRelativeDue(item)}
                {item.dueDate ? (
                  <span className="hidden sm:inline"> · {format.date(item.dueDate)}</span>
                ) : null}
              </span>
            </AttentionItemLink>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Link
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          search={{ status: ReminderStatus.Upcoming }}
          to="/reminders"
        >
          All reminders
        </Link>
      </div>
    </section>
  );
}
