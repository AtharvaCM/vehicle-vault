import { Link } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';
import { useEffect, useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { BulkReminderActions } from '../components/bulk-reminder-actions';
import { ReminderListControls } from '../components/reminder-list-controls';
import { ReminderList } from '../components/reminder-list';
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

type VehicleRemindersPageProps = {
  vehicleId: string;
  searchState: ReminderListSearch;
  onSearchStateChange: (next: Partial<ReminderListSearch>) => void;
};

export function VehicleRemindersPage({
  vehicleId,
  searchState,
  onSearchStateChange,
}: VehicleRemindersPageProps) {
  const vehicleQuery = useVehicle(vehicleId);
  const remindersQuery = useVehicleReminders(vehicleId);
  const bulkCompleteMutation = useBulkCompleteReminders();
  const bulkDeleteMutation = useBulkDeleteReminders();
  const [selectedReminderIds, setSelectedReminderIds] = useState<string[]>([]);
  const searchValue = searchState.search ?? '';
  const status = searchState.status ?? 'all';
  const type = searchState.type ?? 'all';
  const sortBy: ReminderSortOption = searchState.sort ?? defaultReminderSort;

  const vehicleTitle = vehicleQuery.data
    ? vehicleQuery.data.nickname?.trim() || `${vehicleQuery.data.make} ${vehicleQuery.data.model}`
    : 'Vehicle reminders';
  const isVehicleNotFound =
    vehicleQuery.error instanceof ApiError && vehicleQuery.error.status === 404;
  const isReminderVehicleNotFound =
    remindersQuery.error instanceof ApiError && remindersQuery.error.status === 404;
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

  useEffect(() => {
    setSelectedReminderIds((current) =>
      current.filter((reminderId) => visibleReminderIds.includes(reminderId)),
    );
  }, [visibleReminderIds]);

  function resetControls() {
    onSearchStateChange({});
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

  if (isVehicleNotFound || isReminderVehicleNotFound) {
    return (
      <PageContainer>
        <PageTitle
          description="Reminders can only be managed for an existing vehicle."
          title="Vehicle not found"
        />
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to Vehicles
            </Link>
          }
          description="The requested vehicle could not be found, so its reminders are unavailable."
          title="Vehicle not found"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle
        actions={
          <div className="flex gap-3">
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId"
            >
              Back to Vehicle
            </Link>
            <Link
              className={buttonVariants()}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId/reminders/new"
            >
              Add Reminder
            </Link>
          </div>
        }
        description="Keep service, insurance, PUC, and custom reminders tied to this vehicle."
        title={`${vehicleTitle} Reminders`}
      />

      {remindersQuery.isPending ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading reminders</CardTitle>
            <CardDescription>Getting reminders for this vehicle.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Please wait while we load the due items.
          </CardContent>
        </Card>
      ) : remindersQuery.isError ? (
        <ErrorState
          action={
            <Button onClick={() => remindersQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="We couldn't load this vehicle's reminders. Try again in a moment."
          title="Unable to load reminders"
        />
      ) : remindersQuery.data.length ? (
        <div className="grid gap-4">
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
            totalCount={remindersQuery.data.length}
            type={type}
          />
          {filteredReminders.length ? (
            <div className="grid gap-6">
              <ReminderList
                description="Items that need attention immediately."
                emptyMessage="No overdue reminders."
                onSelectionChange={handleSelectionChange}
                reminders={groupedReminders[ReminderStatus.Overdue]}
                selectedReminderIds={selectedReminderIds}
                title="Overdue"
              />
              <ReminderList
                description="Items due today."
                emptyMessage="No reminders are due today."
                onSelectionChange={handleSelectionChange}
                reminders={groupedReminders[ReminderStatus.DueToday]}
                selectedReminderIds={selectedReminderIds}
                title="Due Today"
              />
              <ReminderList
                description="Upcoming reminders for this vehicle."
                emptyMessage="No upcoming reminders."
                onSelectionChange={handleSelectionChange}
                reminders={groupedReminders[ReminderStatus.Upcoming]}
                selectedReminderIds={selectedReminderIds}
                title="Upcoming"
              />
              <ReminderList
                description="Completed reminders retained for history."
                emptyMessage="No completed reminders yet."
                onSelectionChange={handleSelectionChange}
                reminders={groupedReminders[ReminderStatus.Completed]}
                selectedReminderIds={selectedReminderIds}
                title="Completed"
              />
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
      ) : (
        <EmptyState
          action={
            <Link
              className={buttonVariants()}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId/reminders/new"
            >
              Add the first reminder
            </Link>
          }
          description="No reminders have been created for this vehicle yet."
          title="No reminders yet"
        />
      )}
    </PageContainer>
  );
}
