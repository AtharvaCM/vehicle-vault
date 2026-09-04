import { Link } from '@tanstack/react-router';
import { BellRing, CheckCircle2, FileBadge } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { urgencyLabel } from '../utils/format-due';
import { AttentionRow } from './attention-row';
import { VehiclePickerMenu } from './vehicle-picker-menu';

const INITIAL_ROW_LIMIT = 8;
const ATTENTION_CAP = 25;
const URGENCY_ORDER: readonly DashboardUrgency[] = ['overdue', 'today', 'this_week', 'this_month'];

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
          <div className="divide-y divide-slate-100">
            {groups.map((group) => (
              <section aria-label={urgencyLabel(group.urgency)} key={group.urgency}>
                <p className="px-5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  {urgencyLabel(group.urgency)}
                </p>
                <div className="divide-y divide-slate-100">
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
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
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
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/reminders">
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
                    search={{ tab: 'protection' }}
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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className="font-semibold text-slate-900">Nothing needs attention</p>
        <p className="text-[13px] text-slate-500">
          No reminders are due and no documents expire in the next 7 days.
        </p>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border/70 p-0 shadow-sm">
      <CardHeader className="gap-2.5 border-b border-border/60 px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              Needs attention
              {urgentCount > 0 ? (
                <Badge tone={counts.overdue > 0 ? 'danger' : 'warning'}>{urgentCount}</Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              Reminders, documents, and EMIs across every vehicle, most urgent first.
            </CardDescription>
          </div>
          <CardAction>
            <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/reminders">
              All reminders
            </Link>
          </CardAction>
        </div>
      </CardHeader>

      {focus ? (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2">
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
