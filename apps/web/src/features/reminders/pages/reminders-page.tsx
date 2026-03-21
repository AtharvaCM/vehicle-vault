import { Link } from '@tanstack/react-router';
import { ReminderStatus, ReminderType } from '@vehicle-vault/shared';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';

import {
  ReminderListControls,
  type ReminderSortOption,
} from '../components/reminder-list-controls';
import { ReminderList } from '../components/reminder-list';
import { useReminders } from '../hooks/use-reminders';
import { filterAndSortReminders } from '../utils/filter-and-sort-reminders';
import { groupRemindersByStatus } from '../utils/group-reminders-by-status';

export function RemindersPage() {
  const remindersQuery = useReminders();
  const vehiclesQuery = useVehicles();
  const [searchValue, setSearchValue] = useState('');
  const [status, setStatus] = useState<ReminderStatus | 'all'>('all');
  const [type, setType] = useState<ReminderType | 'all'>('all');
  const [sortBy, setSortBy] = useState<ReminderSortOption>('urgency');

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
    setSearchValue('');
    setStatus('all');
    setType('all');
    setSortBy('urgency');
  }

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
            Add Reminder From Vehicle
          </Link>
        }
        description="Review reminders across vehicles with overdue and due-today items separated from the rest."
        title="Reminders"
      />

      {remindersQuery.isPending ? (
        <LoadingState
          description="Fetching reminder records from the API."
          title="Loading reminders"
        />
      ) : remindersQuery.isError ? (
        <ErrorState
          action={
            <Button onClick={() => remindersQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="The reminder list could not be loaded. Make sure the API is running and reachable from the frontend."
          title="Unable to load reminders"
        />
      ) : remindersQuery.data.length ? (
        <div className="grid gap-4">
          <ReminderListControls
            onReset={resetControls}
            onSearchChange={setSearchValue}
            onSortChange={setSortBy}
            onStatusChange={setStatus}
            onTypeChange={setType}
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
                    Add a reminder from a vehicle
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
              Add a reminder from a vehicle
            </Link>
          }
          description="No reminders exist yet. Create one from a vehicle page to start tracking due items."
          title="No reminders yet"
        />
      )}
    </PageContainer>
  );
}
