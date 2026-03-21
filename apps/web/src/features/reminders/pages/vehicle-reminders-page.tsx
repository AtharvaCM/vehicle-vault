import { Link } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';
import { useMemo } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import {
  ReminderListControls,
} from '../components/reminder-list-controls';
import { ReminderList } from '../components/reminder-list';
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

  function resetControls() {
    onSearchStateChange({});
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
              />
              <ReminderList
                description="Items due today."
                emptyMessage="No reminders are due today."
                reminders={groupedReminders[ReminderStatus.DueToday]}
                title="Due Today"
              />
              <ReminderList
                description="Upcoming reminders for this vehicle."
                emptyMessage="No upcoming reminders."
                reminders={groupedReminders[ReminderStatus.Upcoming]}
                title="Upcoming"
              />
              <ReminderList
                description="Completed reminders retained for history."
                emptyMessage="No completed reminders yet."
                reminders={groupedReminders[ReminderStatus.Completed]}
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
