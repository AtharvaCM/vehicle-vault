import { Link } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';
import { useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useVehicleAccess } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { BulkReminderActions } from './bulk-reminder-actions';
import { ReminderListControls } from './reminder-list-controls';
import { ReminderList } from './reminder-list';
import { useBulkCompleteReminders } from '../hooks/use-bulk-complete-reminders';
import { useBulkDeleteReminders } from '../hooks/use-bulk-delete-reminders';
import { useVehicleReminders } from '../hooks/use-vehicle-reminders';
import { filterAndSortReminders } from '../utils/filter-and-sort-reminders';
import { groupRemindersByStatus } from '../utils/group-reminders-by-status';
import {
  defaultReminderSort,
  type ReminderListSearch,
  type ReminderSortOption,
} from '../types/reminder-list-search';

type VehicleReminderListProps = {
  vehicleId: string;
};

/** From this many reminders, the list gets its search and filters. */
export const REMINDER_FILTERS_FROM = 6;

const GROUPS = [
  {
    status: ReminderStatus.Overdue,
    title: 'Overdue',
    description: 'Items that need attention immediately.',
  },
  { status: ReminderStatus.DueToday, title: 'Due today', description: 'Items due today.' },
  {
    status: ReminderStatus.Upcoming,
    title: 'Upcoming',
    description: 'Upcoming reminders for this vehicle.',
  },
  {
    status: ReminderStatus.Completed,
    title: 'Completed',
    description: 'Completed reminders retained for history.',
  },
] as const;

export function VehicleReminderList({ vehicleId }: VehicleReminderListProps) {
  const { canEdit } = useVehicleAccess();
  const remindersQuery = useVehicleReminders(vehicleId);
  // Already loaded by the vehicle page around this tab; only the snooze preview reads it.
  const currentOdometer = useVehicle(vehicleId).data?.odometer;
  const bulkCompleteMutation = useBulkCompleteReminders();
  const bulkDeleteMutation = useBulkDeleteReminders();
  const [selectedReminderIds, setSelectedReminderIds] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [filterState, setSearchState] = useState<ReminderListSearch>({});
  const reminderCount = remindersQuery.data?.length ?? 0;
  const hasFilters = reminderCount >= REMINDER_FILTERS_FROM;
  // A short list has no filters, so none may be left hiding part of it.
  const searchState = hasFilters ? filterState : {};
  const searchValue = searchState.search ?? '';
  const status = searchState.status ?? 'all';
  const type = searchState.type ?? 'all';
  const sortBy: ReminderSortOption = searchState.sort ?? defaultReminderSort;

  const filteredReminders = useMemo(
    () =>
      filterAndSortReminders({
        reminders: remindersQuery.data ?? [],
        searchValue,
        status,
        type,
        sortBy,
      }),
    [remindersQuery.data, searchValue, sortBy, status, type],
  );
  const groupedReminders = useMemo(
    () => groupRemindersByStatus(filteredReminders),
    [filteredReminders],
  );
  const visibleReminderIds = useMemo(
    () => filteredReminders.map((reminder) => reminder.id),
    [filteredReminders],
  );
  const selectedCompletableReminderIds = useMemo(
    () =>
      filteredReminders
        .filter(
          (reminder) =>
            selectedReminderIds.includes(reminder.id) &&
            reminder.status !== ReminderStatus.Completed,
        )
        .map((reminder) => reminder.id),
    [filteredReminders, selectedReminderIds],
  );

  // Drop selected rows the filters now hide. Returning `current` when nothing
  // was dropped keeps the state, so a list that re-renders does not loop.
  useEffect(() => {
    setSelectedReminderIds((current) => {
      const kept = current.filter((reminderId) => visibleReminderIds.includes(reminderId));
      return kept.length === current.length ? current : kept;
    });
  }, [visibleReminderIds]);

  function onSearchStateChange(next: Partial<ReminderListSearch>) {
    setSearchState((current) => ({ ...current, ...next }));
  }

  function resetControls() {
    setSearchState({});
  }

  function handleSelectionChange(reminderId: string, checked: boolean) {
    setSelectedReminderIds((current) => {
      if (checked) {
        return current.includes(reminderId) ? current : [...current, reminderId];
      }

      return current.filter((currentId) => currentId !== reminderId);
    });
  }

  async function handleBulkComplete() {
    if (!selectedCompletableReminderIds.length) {
      return;
    }

    try {
      await bulkCompleteMutation.mutateAsync(selectedCompletableReminderIds);
      appToast.success({
        title: 'Reminders updated',
        description: `Marked ${selectedCompletableReminderIds.length} reminder${selectedCompletableReminderIds.length === 1 ? '' : 's'} as completed.`,
      });
      setSelectedReminderIds((current) =>
        current.filter((reminderId) => !selectedCompletableReminderIds.includes(reminderId)),
      );
    } catch (error) {
      appToast.error({
        title: 'Unable to complete reminders',
        description: getApiErrorMessage(
          error,
          "We couldn't update the selected reminders right now.",
        ),
      });
    }
  }

  async function handleBulkDelete() {
    if (!selectedReminderIds.length) {
      return;
    }

    const idsToDelete = [...selectedReminderIds];

    try {
      await bulkDeleteMutation.mutateAsync(idsToDelete);
      appToast.success({
        title: 'Reminders deleted',
        description: `Deleted ${idsToDelete.length} reminder${idsToDelete.length === 1 ? '' : 's'}.`,
      });
      setSelectedReminderIds([]);
    } catch (error) {
      appToast.error({
        title: 'Unable to delete reminders',
        description: getApiErrorMessage(
          error,
          "We couldn't delete the selected reminders right now.",
        ),
      });
    }
  }

  if (remindersQuery.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading reminders</CardTitle>
          <CardDescription>Getting reminders for this vehicle.</CardDescription>
        </CardHeader>
        <CardContent className="text-ui text-fg-2">
          Please wait while we load the due items.
        </CardContent>
      </Card>
    );
  }

  if (remindersQuery.isError) {
    return (
      <ErrorState
        action={
          <Button onClick={() => remindersQuery.refetch()} variant="secondary">
            Retry
          </Button>
        }
        description="We couldn't load this vehicle's reminders. Try again in a moment."
        title="Unable to load reminders"
      />
    );
  }

  if (!remindersQuery.data.length) {
    return (
      <EmptyState
        action={
          canEdit ? (
            <Link
              className={buttonVariants()}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId/reminders/new"
            >
              Add the first reminder
            </Link>
          ) : undefined
        }
        description={
          canEdit
            ? 'Pick from the suggested schedule below, or add your own.'
            : 'No reminders have been created for this vehicle yet. Whoever owns it can add them.'
        }
        title="No reminders yet"
      />
    );
  }

  function stopSelecting() {
    setIsSelecting(false);
    setSelectedReminderIds([]);
  }

  const onSelectionChange = canEdit && isSelecting ? handleSelectionChange : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ui text-fg-3">
          {reminderCount} {reminderCount === 1 ? 'reminder' : 'reminders'}
        </p>
        {canEdit ? (
          <Button
            aria-pressed={isSelecting}
            onClick={() => (isSelecting ? stopSelecting() : setIsSelecting(true))}
            size="sm"
            type="button"
            variant="outline"
          >
            {isSelecting ? 'Done' : 'Select'}
          </Button>
        ) : null}
      </div>
      {canEdit && isSelecting ? (
        <BulkReminderActions
          isCompleting={bulkCompleteMutation.isPending}
          isDeleting={bulkDeleteMutation.isPending}
          onClearSelection={() => setSelectedReminderIds([])}
          onCompleteSelected={handleBulkComplete}
          onDeleteSelected={handleBulkDelete}
          onSelectAllVisible={() => setSelectedReminderIds(visibleReminderIds)}
          selectedCompletableCount={selectedCompletableReminderIds.length}
          selectedCount={selectedReminderIds.length}
          visibleCount={visibleReminderIds.length}
        />
      ) : null}
      {hasFilters ? (
        <ReminderListControls
          onReset={resetControls}
          onSearchChange={(value) => onSearchStateChange({ search: value || undefined })}
          onSortChange={(value) => onSearchStateChange({ sort: value })}
          onStatusChange={(value) => onSearchStateChange({ status: value })}
          onTypeChange={(value) => onSearchStateChange({ type: value })}
          resultCount={filteredReminders.length}
          searchValue={searchValue}
          sortBy={sortBy}
          status={status}
          totalCount={reminderCount}
          type={type}
        />
      ) : null}
      {filteredReminders.length ? (
        <div className="grid grid-cols-1 gap-6">
          {/* Only the groups that hold something. */}
          {GROUPS.filter((group) => groupedReminders[group.status].length > 0).map((group) => (
            <ReminderList
              currentOdometer={
                group.status === ReminderStatus.Completed ? undefined : currentOdometer
              }
              description={group.description}
              emptyMessage=""
              key={group.status}
              onSelectionChange={onSelectionChange}
              reminders={groupedReminders[group.status]}
              selectedReminderIds={selectedReminderIds}
              showActions={canEdit && group.status !== ReminderStatus.Completed}
              title={group.title}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            <Button onClick={resetControls} variant="secondary">
              Clear filters
            </Button>
          }
          description="Try broadening the search or removing the active status and type filters."
          title="No reminders match these filters"
        />
      )}
    </div>
  );
}
