import { Link } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';
import { useMemo } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';

import {
  ReminderListControls,
} from '../components/reminder-list-controls';
import { ReminderList } from '../components/reminder-list';
import { useReminders } from '../hooks/use-reminders';
import { filterAndSortReminders } from '../utils/filter-and-sort-reminders';
import { groupRemindersByStatus } from '../utils/group-reminders-by-status';
import {
  defaultReminderSort,
  type ReminderListSearch,
  type ReminderSortOption,
} from '../types/reminder-list-search';

type RemindersPageProps = {
  searchState: ReminderListSearch;
  onSearchStateChange: (next: Partial<ReminderListSearch>) => void;
};

export function RemindersPage({
  searchState,
  onSearchStateChange,
}: RemindersPageProps) {
  const remindersQuery = useReminders();
  const vehiclesQuery = useVehicles();
  const searchValue = searchState.search ?? '';
  const status = searchState.status ?? 'all';
  const type = searchState.type ?? 'all';
  const sortBy: ReminderSortOption = searchState.sort ?? defaultReminderSort;

  const vehicleLabelById = Object.fromEntries(
    (vehiclesQuery.data ?? []).map((vehicle) => [
      vehicle.id,
      `${vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`} • ${vehicle.registrationNumber}`,
    ]),
  );
  const filteredReminders = useMemo(
    () =>
      filterAndSortReminders({
        reminders: remindersQuery.data ?? [],
        searchValue,
        status,
        type,
        sortBy,
        vehicleLabelById,
      }),
    [remindersQuery.data, searchValue, sortBy, status, type, vehicleLabelById],
  );
  const groupedReminders = useMemo(
    () => groupRemindersByStatus(filteredReminders),
    [filteredReminders],
  );

  function resetControls() {
    onSearchStateChange({});
  }

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
            Create reminder from vehicle
          </Link>
        }
        description="Track overdue, due today, upcoming, and completed reminders across your garage."
        title="Reminders"
      />

      {remindersQuery.isPending ? (
        <LoadingState
          description="Loading the reminders in your garage."
          title="Loading reminders"
        />
      ) : remindersQuery.isError ? (
        <ErrorState
          action={
            <Button onClick={() => remindersQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="We couldn't load your reminders. Try again in a moment."
          title="Unable to load reminders"
        />
      ) : remindersQuery.data.length ? (
        <div className="grid gap-4">
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
                reminders={groupedReminders[ReminderStatus.Overdue]}
                title="Overdue"
                vehicleLabelById={vehicleLabelById}
              />
              <ReminderList
                description="Items that become due today."
                emptyMessage="No reminders are due today."
                reminders={groupedReminders[ReminderStatus.DueToday]}
                title="Due Today"
                vehicleLabelById={vehicleLabelById}
              />
              <ReminderList
                description="Upcoming reminders that should stay visible."
                emptyMessage="No upcoming reminders."
                reminders={groupedReminders[ReminderStatus.Upcoming]}
                title="Upcoming"
                vehicleLabelById={vehicleLabelById}
              />
              <ReminderList
                description="Completed reminders kept for reference."
                emptyMessage="No completed reminders yet."
                reminders={groupedReminders[ReminderStatus.Completed]}
                title="Completed"
                vehicleLabelById={vehicleLabelById}
              />
            </div>
          ) : (
            <EmptyState
              action={
                <div className="flex flex-wrap gap-3">
                  <Button onClick={resetControls} variant="secondary">
                    Clear filters
                  </Button>
                  <Link className={buttonVariants()} to="/vehicles">
                    Create reminder from vehicle
                  </Link>
                </div>
              }
              description="Try broadening the search or removing the active status and type filters."
              title="No reminders match these filters"
            />
          )}
        </div>
      ) : (
        <EmptyState
          action={
            <Link className={buttonVariants()} to="/vehicles">
              Create reminder from vehicle
            </Link>
          }
          description="Create a reminder from a vehicle to start tracking due items."
          title="No reminders yet"
        />
      )}
    </PageContainer>
  );
}
