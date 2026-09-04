import { Link } from '@tanstack/react-router';
import { BellRing, Coins, ShieldCheck } from 'lucide-react';
import { ReminderStatus } from '@vehicle-vault/shared';

import { buttonVariants } from '@/components/ui/button';
import { formatDate } from '@/lib/utils/format-date';

import type { DashboardAttentionItem, DashboardAttentionKind } from '../types/dashboard';
import { formatRelativeDue } from '../utils/format-due';
import { AttentionItemLink } from './attention-row';

const KIND_ICONS: Record<DashboardAttentionKind, typeof BellRing> = {
  reminder: BellRing,
  document: ShieldCheck,
  loan_emi: Coins,
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
      <div className="flex items-baseline gap-2">
        <h2
          className="text-sm font-semibold uppercase tracking-wide text-slate-500"
          id="coming-up-heading"
        >
          Coming up
        </h2>
        <span className="text-[13px] text-slate-400">Next 30 days</span>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/60 bg-white/70">
        {items.map((item) => {
          const Icon = KIND_ICONS[item.kind];

          return (
            <AttentionItemLink
              className="group flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              item={item}
              key={item.id}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="min-w-0 truncate font-medium text-slate-900 transition-colors group-hover:text-primary">
                {item.title}
              </span>
              {showVehicle ? (
                <span className="min-w-0 truncate text-[13px] text-slate-500">
                  {item.vehicleName}
                </span>
              ) : null}
              <span className="ml-auto shrink-0 text-[13px] tabular-nums text-slate-500">
                {formatRelativeDue(item)}
                {item.dueDate ? (
                  <span className="hidden sm:inline"> · {formatDate(item.dueDate)}</span>
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
