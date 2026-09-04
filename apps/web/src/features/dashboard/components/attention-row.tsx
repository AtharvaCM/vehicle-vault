import { Link } from '@tanstack/react-router';
import { BellOff, Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { formatReminderType } from '@/features/reminders/utils/format-reminder-type';
import { documentKindNouns } from '@/features/vehicle-documents/utils/document-kind-labels';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { DashboardAttentionItem, DashboardUrgency } from '../types/dashboard';
import { formatOdometerMeta, formatRelativeDue } from '../utils/format-due';

const URGENCY_BAR: Record<DashboardUrgency, string> = {
  overdue: 'bg-rose-500',
  today: 'bg-amber-500',
  this_week: 'bg-amber-300',
  this_month: 'bg-sky-400',
};

type AttentionItemLinkProps = {
  item: Pick<DashboardAttentionItem, 'id' | 'kind' | 'vehicleId'>;
  className?: string;
  children: ReactNode;
};

/** The deep link for an attention item: reminder detail, or the vehicle's protection / loans tab. */
export function AttentionItemLink({ item, className, children }: AttentionItemLinkProps) {
  if (item.kind === 'reminder') {
    return (
      <Link className={className} params={{ reminderId: item.id }} to="/reminders/$reminderId">
        {children}
      </Link>
    );
  }

  return (
    <Link
      className={className}
      params={{ vehicleId: item.vehicleId }}
      search={{ tab: item.kind === 'document' ? 'protection' : 'loans' }}
      to="/vehicles/$vehicleId"
    >
      {children}
    </Link>
  );
}

export function attentionBadgeLabel(item: DashboardAttentionItem) {
  if (item.kind === 'document') {
    return item.documentKind ? documentKindNouns[item.documentKind] : 'Document';
  }

  if (item.kind === 'loan_emi') {
    return 'EMI';
  }

  return formatReminderType(item.reminderType ?? 'custom');
}

function MetaDot() {
  return <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />;
}

/**
 * A document row can be snoozed once it's merely a heads-up (`this_week` /
 * `this_month`); an `overdue`/`today` row is actually due, so the API
 * ignores any live snooze for it and the button doesn't offer one.
 */
function isSnoozeEligible(item: DashboardAttentionItem): boolean {
  return (
    item.kind === 'document' && (item.urgency === 'this_week' || item.urgency === 'this_month')
  );
}

type AttentionRowProps = {
  item: DashboardAttentionItem;
  /** Hidden for single-vehicle garages, where the chip would only repeat itself. */
  showVehicle: boolean;
  isPending: boolean;
  onComplete: (item: DashboardAttentionItem) => void;
  onSnooze: (item: DashboardAttentionItem) => void;
};

export function AttentionRow({
  item,
  showVehicle,
  isPending,
  onComplete,
  onSnooze,
}: AttentionRowProps) {
  const relative = formatRelativeDue(item);
  const meta: ReactNode[] = [];

  if (showVehicle) {
    meta.push(
      <span className="min-w-0 truncate" key="vehicle">
        {item.vehicleName}
        <span className="hidden sm:inline"> · {item.registrationNumber}</span>
      </span>,
    );
  }

  meta.push(
    item.dueDate ? (
      // A native title reaches keyboard, touch and screen-reader users; a hover tooltip did not.
      <time
        className="tabular-nums"
        dateTime={item.dueDate}
        key="relative"
        title={formatDate(item.dueDate, { dateStyle: 'full' })}
      >
        {relative}
      </time>
    ) : (
      <span className="tabular-nums" key="relative">
        {relative}
      </span>
    ),
  );

  if (item.dueDate) {
    meta.push(
      <span className="shrink-0 tabular-nums" key="date">
        {formatDate(item.dueDate)}
      </span>,
    );

    if (item.dueOdometer !== undefined) {
      meta.push(
        <span className="tabular-nums" key="odometer">
          {formatOdometerMeta(item.dueOdometer, item.kmUntilDue)}
        </span>,
      );
    }
  }

  if (item.kind === 'loan_emi' && item.amount !== undefined) {
    meta.push(
      <span className="shrink-0 font-medium tabular-nums text-slate-700" key="amount">
        {formatCurrency(item.amount)}
      </span>,
    );
  }

  return (
    <div
      className={cn(
        'relative flex min-h-14 gap-3 px-5 py-3',
        isPending && 'pointer-events-none opacity-50',
      )}
      data-testid="attention-row"
    >
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-0 left-0 w-[3px]', URGENCY_BAR[item.urgency])}
      />

      <AttentionItemLink
        className="group min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        item={item}
      >
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate font-semibold text-slate-900 transition-colors group-hover:text-primary">
            {item.title}
          </p>
          <Badge className="shrink-0 bg-white text-[10px]" variant="outline">
            {attentionBadgeLabel(item)}
          </Badge>
          {item.kind === 'document' && item.provider ? (
            <span className="hidden min-w-0 truncate text-[13px] text-slate-500 sm:inline">
              {item.provider}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
          {meta.map((segment, index) => (
            <span className="flex min-w-0 items-center gap-x-2" key={index}>
              {index > 0 ? <MetaDot /> : null}
              {segment}
            </span>
          ))}
        </div>
      </AttentionItemLink>

      <div className="flex shrink-0 items-start gap-2">
        {item.kind === 'reminder' && item.currentUserRole !== 'viewer' ? (
          <Button
            aria-label={`Mark ${item.title} done`}
            className="h-10 sm:h-8"
            disabled={isPending}
            onClick={() => onComplete(item)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Check aria-hidden="true" />
            Done
          </Button>
        ) : null}
        {item.kind === 'document' ? (
          <>
            {isSnoozeEligible(item) ? (
              <Button
                aria-label={`Snooze ${item.title}`}
                className="h-10 sm:h-8"
                disabled={isPending}
                onClick={() => onSnooze(item)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <BellOff aria-hidden="true" />
                Snooze
              </Button>
            ) : null}
            <Link
              className={buttonVariants({
                size: 'sm',
                variant: 'outline',
                className: 'h-10 sm:h-8',
              })}
              params={{ vehicleId: item.vehicleId }}
              search={{ tab: 'protection' }}
              to="/vehicles/$vehicleId"
            >
              Renew
            </Link>
          </>
        ) : null}
        {item.kind === 'loan_emi' ? (
          <Link
            className={buttonVariants({ size: 'sm', variant: 'outline', className: 'h-10 sm:h-8' })}
            params={{ vehicleId: item.vehicleId }}
            search={{ tab: 'loans' }}
            to="/vehicles/$vehicleId"
          >
            View loan
          </Link>
        ) : null}
      </div>
    </div>
  );
}
