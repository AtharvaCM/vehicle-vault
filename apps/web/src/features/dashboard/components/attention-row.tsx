import { Link } from '@tanstack/react-router';
import { BellOff, Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { DueLine } from '@/components/shared/due-line';
import { Money } from '@/components/shared/money';
import { StatusDot } from '@/components/shared/status-pill';
import { VehicleIdentity } from '@/components/shared/vehicle-identity';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { documentKindNouns } from '@/features/vehicle-documents/utils/document-kind-labels';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { DashboardAttentionItem, DashboardAttentionKind } from '../types/dashboard';
import { ATTENTION_KIND_TABS } from '../utils/attention-kind-tab';
import { formatOdometerMeta, formatRelativeDue } from '../utils/format-due';
import { URGENCY_STATUS } from '../utils/status';
import { useMediaQuery } from '../hooks/use-media-query';

/** Kinds whose date is when something runs out, not when something is due. */
const EXPIRING_KINDS: readonly DashboardAttentionKind[] = ['document', 'accessory'];

/** What each kind of row offers to do, beside the row's own link. */
const KIND_ACTIONS: Partial<Record<DashboardAttentionKind, string>> = {
  loan_emi: 'View loan',
  tyre: 'View tyres',
  service_baseline: 'Add history',
  accessory: 'View accessory',
};

type AttentionItemLinkProps = {
  item: Pick<DashboardAttentionItem, 'id' | 'kind' | 'vehicleId'>;
  className?: string;
  children: ReactNode;
};

/** The deep link for an attention item: reminder detail, or the vehicle tab that fixes it. */
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
      search={{ tab: ATTENTION_KIND_TABS[item.kind] }}
      to="/vehicles/$vehicleId"
    >
      {children}
    </Link>
  );
}

export function attentionBadgeLabel(item: DashboardAttentionItem) {
  switch (item.kind) {
    case 'document':
      return item.documentKind ? documentKindNouns[item.documentKind] : 'Document';
    case 'loan_emi':
      return 'EMI';
    case 'tyre':
      return 'Tyre';
    case 'service_baseline':
      return 'Service history';
    case 'accessory':
      return 'Accessory';
    case 'reminder':
      return format.enumLabel('reminderType', item.reminderType ?? 'custom');
  }
}

function MetaDot() {
  return <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-line" />;
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
  // `sm` and up: the due line moves to the row's end, on a line of its own. Narrower, it
  // has to share the meta line with everything else, so it reads inline instead.
  const isWideRow = useMediaQuery('(min-width: 640px)');
  const dueMode: 'due' | 'ends' = EXPIRING_KINDS.includes(item.kind) ? 'ends' : 'due';
  const meta: ReactNode[] = [];
  let dueLineAtRowEnd: ReactNode = null;

  if (!item.dueDate) {
    // Undated: an odometer-only due or a verdict with nothing to count down. Say what it
    // rests on, in the urgency's colour.
    meta.push(
      <StatusDot key="relative" status={URGENCY_STATUS[item.urgency]}>
        {formatRelativeDue(item)}
      </StatusDot>,
    );
  } else if (isWideRow) {
    dueLineAtRowEnd = (
      <DueLine date={item.dueDate} days={item.daysUntilDue} layout="stacked" mode={dueMode} />
    );
  } else {
    meta.push(
      <DueLine
        date={item.dueDate}
        days={item.daysUntilDue}
        key="relative"
        layout="inline"
        mode={dueMode}
      />,
    );
  }

  if (item.dueDate && item.dueOdometer !== undefined) {
    meta.push(
      <span className="tabular-nums" key="odometer">
        {formatOdometerMeta(item.dueOdometer, item.kmUntilDue)}
      </span>,
    );
  }

  if (item.kind === 'loan_emi' && item.amount !== undefined) {
    meta.push(
      <span className="shrink-0 font-medium text-fg-2" key="amount">
        <Money value={item.amount} />
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
      <AttentionItemLink
        className="group min-w-0 flex-1 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        item={item}
      >
        {showVehicle ? (
          <VehicleIdentity
            className="mb-1"
            layout="row"
            name={item.vehicleName}
            registration={item.registrationNumber}
          />
        ) : null}
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate font-semibold text-fg transition-colors group-hover:text-primary">
            {item.title}
          </p>
          <Badge className="shrink-0 bg-surface text-caption" variant="outline">
            {attentionBadgeLabel(item)}
          </Badge>
          {item.kind === 'document' && item.provider ? (
            <span className="hidden min-w-0 truncate text-small text-fg-3 sm:inline">
              {item.provider}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-3">
          {meta.map((segment, index) => (
            <span className="flex min-w-0 items-center gap-x-2" key={index}>
              {index > 0 ? <MetaDot /> : null}
              {segment}
            </span>
          ))}
        </div>
      </AttentionItemLink>

      {dueLineAtRowEnd ? (
        <div className="flex shrink-0 items-center self-center">{dueLineAtRowEnd}</div>
      ) : null}

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
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
              params={{ vehicleId: item.vehicleId }}
              search={{ tab: 'protection' }}
              to="/vehicles/$vehicleId"
            >
              Renew
            </Link>
          </>
        ) : null}
        {item.kind !== 'reminder' && KIND_ACTIONS[item.kind] ? (
          // The row already leads to the same tab; on a phone the title needs the room more.
          <Link
            className={buttonVariants({
              size: 'sm',
              variant: 'outline',
              className: 'max-sm:hidden',
            })}
            params={{ vehicleId: item.vehicleId }}
            search={{ tab: ATTENTION_KIND_TABS[item.kind] }}
            to="/vehicles/$vehicleId"
          >
            {KIND_ACTIONS[item.kind]}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
