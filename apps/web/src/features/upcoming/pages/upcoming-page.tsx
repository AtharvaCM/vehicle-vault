import {
  UPCOMING_KIND_FILTERS,
  upcomingGroupOf,
  type UpcomingGroup as UpcomingGroupName,
  type UpcomingItem,
  type UpcomingKindFilter,
} from '@vehicle-vault/shared';
import { CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSnoozeDocument } from '@/features/dashboard/hooks/use-snooze-document';
import { useCompleteReminder } from '@/features/reminders/hooks/use-complete-reminder';
import { useSnoozeReminder } from '@/features/reminders/hooks/use-snooze-reminder';
import { VehiclePickerDialog } from '@/features/vehicles/components/vehicle-picker-dialog';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import { UpcomingGroup } from '../components/upcoming-group';
import { UpcomingRow } from '../components/upcoming-row';
import { useUpcoming } from '../hooks/use-upcoming';
import type { UpcomingSearch } from '../types/upcoming-search';

const ALL = 'all';

const KIND_LABELS: Record<UpcomingKindFilter, string> = {
  reminders: 'Reminders',
  papers: 'Papers',
  emis: 'EMIs',
  other: 'Other',
};

/** What each group says when it has nothing, so an empty group still reads as checked. */
const EMPTY_TEXT: Record<UpcomingGroupName, string> = {
  late: 'Nothing late.',
  this_week: 'Nothing else this week.',
  this_month: 'Nothing else in the next 30 days.',
  later: 'Nothing further ahead.',
};

type UpcomingPageProps = {
  searchState: UpcomingSearch;
  onSearchStateChange: (next: Partial<UpcomingSearch>) => void;
};

/**
 * Everything with a date across the garage, in the groups Home counts from:
 * Late, This week, This month, then Later. The rows come from the API's one
 * classification, so this page and Home never disagree about what is late.
 */
export function UpcomingPage({ searchState, onSearchStateChange }: UpcomingPageProps) {
  const vehiclesQuery = useVehicles();
  const upcomingQuery = useUpcoming({ vehicleId: searchState.vehicle, kind: searchState.kind });
  const completeReminder = useCompleteReminder();
  const snoozeReminder = useSnoozeReminder();
  const snoozeDocument = useSnoozeDocument();
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  // A finished row stays on screen until the refetch drops or moves it, so it
  // stays dimmed until the data changes: keyed to the data it was settled on.
  const [settledOn, setSettledOn] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [announcement, setAnnouncement] = useState('');

  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);
  const pages = upcomingQuery.data?.pages;
  const firstPage = pages?.[0];
  const rowsByGroup = useMemo(() => {
    const groups: Record<UpcomingGroupName, UpcomingItem[]> = {
      late: [],
      this_week: [],
      this_month: [],
      later: [],
    };
    // Every page repeats the near groups; only `later` rows differ page to page.
    pages?.forEach((page, index) => {
      for (const item of page.items) {
        const group = upcomingGroupOf(item.urgency);
        if (group === 'later' || index === 0) groups[group].push(item);
      }
    });
    return groups;
  }, [pages]);

  const filtered = Boolean(searchState.vehicle || searchState.kind);
  const showVehicle = !searchState.vehicle && vehicles.length !== 1;
  const counts = firstPage?.counts;
  const nearCount = counts ? counts.late + counts.this_week + counts.this_month : 0;

  function track(
    item: UpcomingItem,
    run: (callbacks: { onSuccess: () => void; onError: (error: unknown) => void }) => void,
    messages: { success: string; announce: string; failure: string },
  ) {
    setPendingIds((previous) => new Set(previous).add(item.id));
    run({
      onSuccess: () => {
        setSettledOn((previous) => new Map(previous).set(item.id, upcomingQuery.dataUpdatedAt));
        appToast.success({
          title: messages.success,
          description: `${item.title} · ${item.vehicleName}`,
        });
        // Name the vehicle so two same-titled rows still produce distinct announcements.
        setAnnouncement(`${item.title} · ${item.vehicleName} ${messages.announce}.`);
      },
      onError: (error) => {
        appToast.error({ title: messages.failure, description: getApiErrorMessage(error) });
      },
    });
  }

  function settle(id: string) {
    setPendingIds((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }

  function handleComplete(item: UpcomingItem) {
    track(
      item,
      (callbacks) =>
        completeReminder.mutate(item.id, { ...callbacks, onSettled: () => settle(item.id) }),
      {
        success: 'Reminder completed',
        announce: 'marked done',
        failure: 'Unable to complete reminder',
      },
    );
  }

  function handleSnoozeReminder(item: UpcomingItem) {
    track(
      item,
      (callbacks) =>
        snoozeReminder.mutate(item.id, { ...callbacks, onSettled: () => settle(item.id) }),
      { success: 'Snoozed a week', announce: 'snoozed', failure: 'Unable to snooze' },
    );
  }

  function handleSnoozePaper(item: UpcomingItem) {
    const documentKind = item.documentKind;
    if (item.kind !== 'document' || !documentKind) return;
    track(
      item,
      (callbacks) =>
        snoozeDocument.mutate(
          { documentKind, documentId: item.id },
          { ...callbacks, onSettled: () => settle(item.id) },
        ),
      { success: 'Snoozed', announce: 'snoozed', failure: 'Unable to snooze' },
    );
  }

  function renderRows(items: UpcomingItem[]) {
    return items.map((item) => (
      <UpcomingRow
        isPending={
          pendingIds.has(item.id) || settledOn.get(item.id) === upcomingQuery.dataUpdatedAt
        }
        item={item}
        key={item.id}
        onComplete={handleComplete}
        onSnoozePaper={handleSnoozePaper}
        onSnoozeReminder={handleSnoozeReminder}
        showVehicle={showVehicle}
      />
    ));
  }

  function renderBody() {
    if (upcomingQuery.isPending) {
      return <LoadingState description="Checking what's due across your garage." title="Loading" />;
    }

    if (upcomingQuery.isError || !counts) {
      return (
        <ErrorState
          action={
            <Button onClick={() => upcomingQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="We couldn't load what's coming up. Try again in a moment."
          title="Unable to load Upcoming"
        />
      );
    }

    if (filtered && nearCount + counts.later === 0) {
      return (
        <EmptyState
          action={
            <Button
              onClick={() => onSearchStateChange({ vehicle: undefined, kind: undefined })}
              variant="secondary"
            >
              Show everything
            </Button>
          }
          description="Nothing with a date matches this filter."
          title="Nothing here"
        />
      );
    }

    return (
      <Card className="gap-0 overflow-hidden p-0" data-testid="upcoming-timeline">
        <div className="divide-y divide-line-subtle">
          {nearCount === 0 ? (
            <div
              className="flex flex-col items-center gap-2 px-6 py-10 text-center"
              data-testid="upcoming-all-clear"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-ok-tint text-ok">
                <CheckCircle2 aria-hidden="true" className="size-5" />
              </div>
              <h2 className="font-semibold text-fg">All clear</h2>
              <p className="text-small text-fg-3">Nothing is late or due in the next 30 days.</p>
            </div>
          ) : (
            (['late', 'this_week', 'this_month'] as const).map((group) => (
              <UpcomingGroup
                count={counts[group]}
                emptyText={EMPTY_TEXT[group]}
                group={group}
                key={group}
              >
                {renderRows(rowsByGroup[group])}
              </UpcomingGroup>
            ))
          )}
          <UpcomingGroup
            count={counts.later}
            emptyText={EMPTY_TEXT.later}
            footer={
              upcomingQuery.hasNextPage ? (
                <div className="border-t border-line-subtle px-5 py-3">
                  <Button
                    disabled={upcomingQuery.isFetchingNextPage}
                    onClick={() => upcomingQuery.fetchNextPage()}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {upcomingQuery.isFetchingNextPage
                      ? 'Loading…'
                      : `Show more (${format.number(counts.later - rowsByGroup.later.length)} left)`}
                  </Button>
                </div>
              ) : null
            }
            group="later"
          >
            {renderRows(rowsByGroup.later)}
          </UpcomingGroup>
        </div>
      </Card>
    );
  }

  return (
    <PageContainer>
      <PageTitle
        actions={
          <VehiclePickerDialog
            buildLink={(vehicleId) => ({
              to: '/vehicles/$vehicleId/reminders/new',
              params: { vehicleId },
            })}
            dialogDescription="Choose which vehicle this reminder is for."
            dialogTitle="Add reminder"
            isLoading={vehiclesQuery.isPending}
            triggerLabel="Add reminder"
            variant="secondary"
            vehicles={vehicles}
          />
        }
        description={statusLine(counts)}
        title="Upcoming"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {vehicles.length > 1 ? (
          <Select
            onValueChange={(value) =>
              onSearchStateChange({ vehicle: value === ALL ? undefined : value })
            }
            value={searchState.vehicle ?? ALL}
          >
            <SelectTrigger aria-label="Vehicle" className="sm:w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All vehicles</SelectItem>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`} ·{' '}
                  {format.registration(vehicle.registrationNumber)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <ToggleGroup
          aria-label="Kind"
          className="flex-wrap"
          onValueChange={(value) =>
            // Radix sends '' when the pressed item is pressed again: that means all.
            onSearchStateChange({
              kind: value && value !== ALL ? (value as UpcomingKindFilter) : undefined,
            })
          }
          type="single"
          value={searchState.kind ?? ALL}
        >
          <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
          {UPCOMING_KIND_FILTERS.map((kind) => (
            <ToggleGroupItem key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {renderBody()}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </PageContainer>
  );
}

/** "1 late · 4 this week · 1 this month", or what the page holds when none of those apply. */
function statusLine(counts: Record<UpcomingGroupName, number> | undefined): string {
  if (!counts) return 'Everything with a date across your garage.';

  const parts = [
    counts.late > 0 ? `${format.number(counts.late)} late` : null,
    counts.this_week > 0 ? `${format.number(counts.this_week)} this week` : null,
    counts.this_month > 0 ? `${format.number(counts.this_month)} this month` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'Nothing due in the next 30 days.';
}
