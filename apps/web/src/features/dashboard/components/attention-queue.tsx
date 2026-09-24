import { Link } from '@tanstack/react-router';
import { BellRing, CheckCircle2, FileBadge } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { SectionHeader } from '@/components/shared/section-header';
import { StatusDot, StatusPill } from '@/components/shared/status-pill';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useCompleteReminder } from '@/features/reminders/hooks/use-complete-reminder';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { useSnoozeDocument } from '../hooks/use-snooze-document';
import type {
  DashboardAttentionItem,
  DashboardSummary,
  DashboardUrgency,
} from '../types/dashboard';
import type { DashboardFocus, DashboardSearch } from '../types/dashboard-search';
import { URGENCY_STATUS } from '../utils/status';
import { urgencyLabel } from '../utils/format-due';
import { AttentionRow } from './attention-row';
import { VehiclePickerMenu } from './vehicle-picker-menu';

const INITIAL_ROW_LIMIT = 8;
const ATTENTION_CAP = 25;
const URGENCY_ORDER: readonly DashboardUrgency[] = ['overdue', 'today', 'this_week', 'this_month'];

/** The group header's words: sentence case, distinct from `urgencyLabel`'s aria text. */
const GROUP_WORDS: Record<DashboardUrgency, string> = {
  overdue: 'Late',
  today: 'Today',
  this_week: 'This week',
  this_month: 'This month',
};

const FOCUS_LABELS: Record<DashboardFocus, { chip: string; empty: string }> = {
  overdue: { chip: 'Overdue', empty: 'Nothing overdue' },
  week: { chip: 'Due this week', empty: 'Nothing due this week' },
  documents: { chip: 'Documents expiring', empty: 'Nothing expiring' },
};

type AttentionQueueProps = {
  summary: DashboardSummary;
  /** Output of `splitAttention(...).queue`. */
  queue: DashboardAttentionItem[];
  focus?: DashboardFocus;
  onSearchStateChange: (next: Partial<DashboardSearch>) => void;
};

export function AttentionQueue({
  summary,
  queue,
  focus,
  onSearchStateChange,
}: AttentionQueueProps) {
  const completeReminder = useCompleteReminder();
  const snoozeDocument = useSnoozeDocument();
  const [expanded, setExpanded] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const counts = summary.attentionCounts;
  const urgentCount = counts.overdue + counts.today + counts.thisWeek;
  const showVehicle = summary.vehicles.length > 1;
  // Each mutation hook only exposes its latest call, and a completed/snoozed row stays rendered
  // until the summary refetch drops it — so track in-flight and just-settled ids locally, shared
  // across both actions since row ids never collide across kinds.
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [completedIds, setCompletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const visibleRows = expanded ? queue : queue.slice(0, INITIAL_ROW_LIMIT);
  const groups = URGENCY_ORDER.map((urgency) => ({
    urgency,
    items: visibleRows.filter((item) => item.urgency === urgency),
  })).filter((group) => group.items.length > 0);

  const nothingTracked =
    queue.length === 0 &&
    counts.total === 0 &&
    summary.vehicles.every((vehicle) => vehicle.documents.insurance?.state === 'missing') &&
    Object.values(summary.reminderCounts).every((count) => count === 0);

  function clearFocus() {
    onSearchStateChange({ focus: undefined });
  }

  function handleComplete(item: DashboardAttentionItem) {
    setPendingIds((previous) => new Set(previous).add(item.id));
    completeReminder.mutate(item.id, {
      onSuccess: () => {
        setCompletedIds((previous) => new Set(previous).add(item.id));
        appToast.success({
          title: 'Reminder completed',
          description: `${item.title} · ${item.vehicleName}`,
        });
        // Name the vehicle so two same-titled reminders still produce distinct announcements.
        setAnnouncement(`${item.title} · ${item.vehicleName} marked done.`);
      },
      onError: (error) => {
        appToast.error({
          title: 'Unable to complete reminder',
          description: getApiErrorMessage(error),
        });
      },
      onSettled: () => {
        setPendingIds((previous) => {
          const next = new Set(previous);
          next.delete(item.id);
          return next;
        });
      },
    });
  }

  function handleSnooze(item: DashboardAttentionItem) {
    if (item.kind !== 'document' || !item.documentKind) return;
    const documentKind = item.documentKind;

    setPendingIds((previous) => new Set(previous).add(item.id));
    snoozeDocument.mutate(
      { documentKind, documentId: item.id },
      {
        onSuccess: () => {
          setCompletedIds((previous) => new Set(previous).add(item.id));
          appToast.success({
            title: 'Snoozed',
            description: `${item.title} · ${item.vehicleName}`,
          });
          setAnnouncement(`${item.title} · ${item.vehicleName} snoozed.`);
        },
        onError: (error) => {
          appToast.error({
            title: 'Unable to snooze',
            description: getApiErrorMessage(error),
          });
        },
        onSettled: () => {
          setPendingIds((previous) => {
            const next = new Set(previous);
            next.delete(item.id);
            return next;
          });
        },
      },
    );
  }

  function renderBody() {
    if (queue.length > 0) {
      return (
        <>
          <div className="divide-y divide-line-subtle">
            {groups.map((group) => (
              <section aria-label={urgencyLabel(group.urgency)} key={group.urgency}>
                <div className="px-5 pb-1 pt-3">
                  <StatusDot status={URGENCY_STATUS[group.urgency]}>
                    {GROUP_WORDS[group.urgency]}
                  </StatusDot>
                </div>
                <div className="divide-y divide-line-subtle">
                  {group.items.map((item) => (
                    <AttentionRow
                      isPending={pendingIds.has(item.id) || completedIds.has(item.id)}
                      item={item}
                      key={item.id}
                      onComplete={handleComplete}
                      onSnooze={handleSnooze}
                      showVehicle={showVehicle}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          {queue.length > INITIAL_ROW_LIMIT || summary.attentionTotal > ATTENTION_CAP ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-5 py-3">
              {queue.length > INITIAL_ROW_LIMIT ? (
                <Button
                  onClick={() => setExpanded((value) => !value)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {expanded ? 'Show fewer' : `Show all ${queue.length}`}
                </Button>
              ) : null}
              {summary.attentionTotal > ATTENTION_CAP ? (
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/upcoming">
                  See all reminders
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      );
    }

    if (focus) {
      return (
        <div className="p-5">
          <EmptyState
            action={
              <Button onClick={clearFocus} size="sm" type="button" variant="secondary">
                Clear filter
              </Button>
            }
            description="Clear the filter to see everything else."
            title={FOCUS_LABELS[focus].empty}
          />
        </div>
      );
    }

    if (nothingTracked) {
      const firstVehicle = summary.vehicles[0];

      return (
        <div className="p-5">
          <EmptyState
            action={
              <>
                <VehiclePickerMenu
                  buildLink={(vehicleId) => ({
                    to: '/vehicles/$vehicleId/reminders/new',
                    params: { vehicleId },
                  })}
                  icon={BellRing}
                  label="Add reminder"
                  size="sm"
                  variant="default"
                  vehicles={summary.vehicles}
                />
                {firstVehicle ? (
                  <Link
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    params={{ vehicleId: firstVehicle.id }}
                    search={{ tab: 'papers' }}
                    to="/vehicles/$vehicleId"
                  >
                    Add documents
                  </Link>
                ) : null}
              </>
            }
            description="Add insurance and PUC dates to a vehicle, or create a reminder, and lapses will show up here before they happen."
            icon={FileBadge}
            title="Nothing is being tracked yet"
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ok-tint text-ok">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="font-semibold text-fg">Nothing needs attention</p>
        <p className="text-small text-fg-3">Nothing is overdue or due in the next 7 days.</p>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border/70 p-0 shadow-xs">
      <CardHeader className="border-b border-border/60 px-5 pb-4 pt-5">
        <SectionHeader
          actions={
            <>
              {urgentCount > 0 ? (
                <StatusPill status={counts.overdue > 0 ? 'late' : 'soon'}>{urgentCount}</StatusPill>
              ) : null}
              <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/upcoming">
                Everything upcoming
              </Link>
            </>
          }
          description="Everything due or wrong across every vehicle, most urgent first."
          title="Needs attention"
        />
      </CardHeader>

      {focus ? (
        <div className="flex items-center gap-2 border-b border-line-subtle bg-page/60 px-5 py-2">
          <Badge variant="outline">Showing: {FOCUS_LABELS[focus].chip}</Badge>
          <Button onClick={clearFocus} size="xs" type="button" variant="ghost">
            Clear
          </Button>
        </div>
      ) : null}

      <CardContent className="p-0">{renderBody()}</CardContent>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </Card>
  );
}
