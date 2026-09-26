import { Link, useNavigate } from '@tanstack/react-router';
import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  FuelType,
  upcomingGroupOf,
  type UpcomingGroup,
  type UpcomingItem,
} from '@vehicle-vault/shared';

import { DueLine } from '@/components/shared/due-line';
import { Money } from '@/components/shared/money';
import { StatusDot, type Status } from '@/components/shared/status-pill';
import { SwipeRow, type SwipeAction } from '@/components/shared/swipe-row';
import { VehicleIdentity } from '@/components/shared/vehicle-identity';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AttentionItemLink,
  attentionBadgeLabel,
} from '@/features/dashboard/components/attention-row';
import { useMediaQuery } from '@/features/dashboard/hooks/use-media-query';
import type {
  DashboardAttentionItem,
  DashboardAttentionKind,
} from '@/features/dashboard/types/dashboard';
import { ATTENTION_KIND_SEARCH } from '@/features/dashboard/utils/attention-kind-tab';
import { formatOdometerMeta, formatRelativeDue } from '@/features/dashboard/utils/format-due';
import { logServiceSearchFor, reminderDoneAction } from '@/features/reminders/utils/reminder-done';
import { format } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Kinds whose date is when something runs out, not when something is due (mirrors AttentionRow). */
const EXPIRING_KINDS: readonly DashboardAttentionKind[] = ['document', 'accessory'];

/** The group's status colour, so a row's "when" agrees with the section it sits in. */
export const UPCOMING_GROUP_STATUS: Record<UpcomingGroup, Status> = {
  late: 'late',
  this_week: 'soon',
  this_month: 'info',
  later: 'ended',
};

/**
 * When an undated verdict (a worn tyre, unknown service history) is due: its
 * group in words. What it rests on is already the row's second line.
 */
const UNDATED_WHEN: Record<UpcomingGroup, string> = {
  late: 'Now',
  this_week: 'This week',
  this_month: 'When you can',
  later: 'Later',
};

/** What each kind without its own verb offers, beside the row's own link. */
const KIND_ACTIONS: Partial<Record<DashboardAttentionKind, string>> = {
  loan_emi: 'View loan',
  tyre: 'View tyres',
  service_baseline: 'Add history',
  accessory: 'View accessory',
};

/** The "what" column's second line, first rule that applies. */
function secondaryLine(item: UpcomingItem): ReactNode {
  switch (item.kind) {
    case 'document':
      if (item.snoozedUntil) {
        return `Snoozed until ${format.date(item.snoozedUntil, 'short')}`;
      }
      return item.provider ?? attentionBadgeLabel(item as DashboardAttentionItem);
    case 'loan_emi':
      return item.amount !== undefined ? <Money value={item.amount} /> : null;
    case 'tyre':
    case 'service_baseline':
      return item.detail ?? null;
    case 'accessory':
      return 'Accessory warranty';
    case 'reminder':
      if (item.dueDate && item.dueOdometer !== undefined) {
        return formatOdometerMeta(item.dueOdometer, item.kmUntilDue);
      }
      return attentionBadgeLabel(item as DashboardAttentionItem);
  }
}

/** A paper can be snoozed once it's merely a heads-up, and only while not already snoozed. */
function isPaperSnoozeEligible(item: UpcomingItem): boolean {
  return (
    item.kind === 'document' &&
    !item.snoozedUntil &&
    (item.urgency === 'this_week' || item.urgency === 'this_month')
  );
}

type OverflowEntry = { label: string; onSelect: () => void };

type UpcomingRowProps = {
  item: UpcomingItem;
  /** False when the page is filtered to one vehicle or the garage has one: the plate would only repeat itself. */
  showVehicle: boolean;
  isPending: boolean;
  onComplete: (item: UpcomingItem) => void;
  /** Opens the shared Snooze dialog for a reminder. */
  onSnoozeReminder: (item: UpcomingItem) => void;
  onSnoozePaper: (item: UpcomingItem) => void;
};

/**
 * One cross-vehicle timeline row: an S plate (optional), what needs doing,
 * when, and one verb, with anything else tucked in an overflow menu. Reuses
 * Home's attention-row building blocks so the two lists can never disagree.
 */
export function UpcomingRow({
  item,
  showVehicle,
  isPending,
  onComplete,
  onSnoozeReminder,
  onSnoozePaper,
}: UpcomingRowProps) {
  // `sm` and up: the due words and date stack at the row's end; narrower, they read inline.
  const isWideRow = useMediaQuery('(min-width: 640px)');
  const navigate = useNavigate();
  const group = upcomingGroupOf(item.urgency);
  const isViewer = item.currentUserRole === 'viewer';
  const emphasise = group === 'late' || group === 'this_week';

  let primary: ReactNode;
  const overflow: OverflowEntry[] = [];
  // On a phone the row swipes: right for its primary verb, left for Snooze.
  let swipeRight: SwipeAction | undefined;
  let swipeLeft: SwipeAction | undefined;

  if (item.kind === 'reminder') {
    if (isViewer) {
      primary = (
        <Link
          className={buttonVariants({ variant: 'outline' })}
          params={{ reminderId: item.id }}
          to="/reminders/$reminderId"
        >
          View
        </Link>
      );
      swipeRight = {
        label: 'View',
        run: () => void navigate({ to: '/reminders/$reminderId', params: { reminderId: item.id } }),
      };
    } else if (reminderDoneAction(item) === 'log') {
      // Its Done is logging the service: the form opens on its category, and
      // saving the record completes the reminder.
      primary = (
        <Link
          className={buttonVariants({ variant: emphasise ? 'default' : 'outline' })}
          params={{ vehicleId: item.vehicleId }}
          search={logServiceSearchFor(item)}
          to="/vehicles/$vehicleId/maintenance/new"
        >
          Log service
        </Link>
      );
      overflow.push(
        { label: 'Mark done without logging', onSelect: () => onComplete(item) },
        { label: 'Snooze', onSelect: () => onSnoozeReminder(item) },
      );
      swipeRight = {
        label: 'Log service',
        run: () =>
          void navigate({
            to: '/vehicles/$vehicleId/maintenance/new',
            params: { vehicleId: item.vehicleId },
            search: logServiceSearchFor(item),
          }),
      };
      swipeLeft = { label: 'Snooze', run: () => onSnoozeReminder(item) };
    } else {
      primary = (
        <Button
          aria-label={`Mark ${item.title} done`}
          disabled={isPending}
          onClick={() => onComplete(item)}
          type="button"
          variant="outline"
        >
          Done
        </Button>
      );
      overflow.push({ label: 'Snooze', onSelect: () => onSnoozeReminder(item) });
      swipeRight = { label: 'Done', run: () => onComplete(item) };
      swipeLeft = { label: 'Snooze', run: () => onSnoozeReminder(item) };
    }
  } else if (item.kind === 'document') {
    primary = (
      <Link
        className={buttonVariants({ variant: !isViewer && emphasise ? 'default' : 'outline' })}
        params={{ vehicleId: item.vehicleId }}
        search={{ tab: 'papers' }}
        to="/vehicles/$vehicleId"
      >
        {isViewer ? 'View papers' : 'Renew'}
      </Link>
    );
    swipeRight = {
      label: isViewer ? 'View papers' : 'Renew',
      run: () =>
        void navigate({
          to: '/vehicles/$vehicleId',
          params: { vehicleId: item.vehicleId },
          search: { tab: 'papers' },
        }),
    };
    if (isPaperSnoozeEligible(item)) {
      overflow.push({ label: 'Snooze', onSelect: () => onSnoozePaper(item) });
      swipeLeft = { label: 'Snooze', run: () => onSnoozePaper(item) };
    }
  } else {
    primary = (
      <Link
        className={buttonVariants({ variant: 'outline' })}
        params={{ vehicleId: item.vehicleId }}
        search={ATTENTION_KIND_SEARCH[item.kind]}
        to="/vehicles/$vehicleId"
      >
        {KIND_ACTIONS[item.kind]}
      </Link>
    );
    const label = KIND_ACTIONS[item.kind];
    const kindSearch = ATTENTION_KIND_SEARCH[item.kind];
    if (label) {
      swipeRight = {
        label,
        run: () =>
          void navigate({
            to: '/vehicles/$vehicleId',
            params: { vehicleId: item.vehicleId },
            search: kindSearch,
          }),
      };
    }
  }

  const dueMode: 'due' | 'ends' = EXPIRING_KINDS.includes(item.kind) ? 'ends' : 'due';
  const whenNode = item.dueDate ? (
    <DueLine
      date={item.dueDate}
      days={item.daysUntilDue}
      className="justify-end"
      layout={isWideRow ? 'stacked' : 'inline'}
      mode={dueMode}
    />
  ) : (
    <StatusDot status={UPCOMING_GROUP_STATUS[group]}>
      {item.dueOdometer !== undefined ? formatRelativeDue(item) : UNDATED_WHEN[group]}
    </StatusDot>
  );

  const secondary = secondaryLine(item);
  const linkClassName =
    'min-w-0 self-center rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  return (
    <SwipeRow disabled={isPending} left={swipeLeft} right={swipeRight}>
      <div
        className={cn(
          // Phone: plate, then "when" across the rest of the first line; the title
          // across the plate's column and the middle, the verb at the end. A wide
          // "when" never squeezes the title that way.
          'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3',
          showVehicle
            ? 'sm:grid-cols-[132px_minmax(0,1fr)_112px_auto]'
            : 'sm:grid-cols-[minmax(0,1fr)_112px_auto]',
          isPending && 'pointer-events-none opacity-50',
        )}
        data-kind={item.kind}
        data-testid="upcoming-row"
      >
        {showVehicle ? (
          <AttentionItemLink
            className={cn(linkClassName, 'col-start-1 row-start-1 sm:row-start-1')}
            item={item}
          >
            <VehicleIdentity
              layout="row"
              electric={item.vehicleFuelType === FuelType.Electric}
              name={item.vehicleName}
              registration={item.registrationNumber}
            />
          </AttentionItemLink>
        ) : null}

        <div
          className={cn(
            'col-span-2 col-start-2 row-start-1 flex justify-end sm:col-span-1 sm:row-start-1',
            showVehicle ? 'sm:col-start-3' : 'sm:col-start-2',
          )}
        >
          {whenNode}
        </div>

        <AttentionItemLink
          className={cn(
            linkClassName,
            'col-span-2 col-start-1 row-start-2 sm:col-span-1 sm:row-start-1',
            showVehicle ? 'sm:col-start-2' : 'sm:col-start-1',
          )}
          item={item}
        >
          <p className="truncate text-body font-semibold text-fg">{item.title}</p>
          {secondary !== null ? <p className="truncate text-small text-fg-2">{secondary}</p> : null}
        </AttentionItemLink>

        <div
          className={cn(
            'col-start-3 row-start-2 flex items-center justify-end gap-1 sm:row-start-1',
            showVehicle ? 'sm:col-start-4' : 'sm:col-start-3',
          )}
        >
          {primary}
          {overflow.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={`More actions for ${item.title}`}
                  disabled={isPending}
                  size="icon-sm"
                  variant="ghost"
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflow.map((entry) => (
                  <DropdownMenuItem key={entry.label} onClick={entry.onSelect}>
                    {entry.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </SwipeRow>
  );
}
