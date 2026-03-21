import { Link } from '@tanstack/react-router';
import { ReminderStatus, ReminderType } from '@vehicle-vault/shared';
import { useMemo, useState } from 'react';

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
  type ReminderSortOption,
} from '../components/reminder-list-controls';
import { ReminderList } from '../components/reminder-list';
import { useVehicleReminders } from '../hooks/use-vehicle-reminders';
import { filterAndSortReminders } from '../utils/filter-and-sort-reminders';
import { groupRemindersByStatus } from '../utils/group-reminders-by-status';

type VehicleRemindersPageProps = {
  vehicleId: string;
};

export function VehicleRemindersPage({ vehicleId }: VehicleRemindersPageProps) {
  const vehicleQuery = useVehicle(vehicleId);
  const remindersQuery = useVehicleReminders(vehicleId);
  const [searchValue, setSearchValue] = useState('');
  const [status, setStatus] = useState<ReminderStatus | 'all'>('all');
  const [type, setType] = useState<ReminderType | 'all'>('all');
  const [sortBy, setSortBy] = useState<ReminderSortOption>('urgency');

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
    setSearchValue('');
    setStatus('all');
    setType('all');
    setSortBy('urgency');
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
        description="Keep due items attached to a vehicle so service, insurance, and custom reminders stay contextual."
        title={`${vehicleTitle} Reminders`}
      />

      {remindersQuery.isPending ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading reminders</CardTitle>
            <CardDescription>Fetching reminders for this vehicle.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Please wait while the reminders load.
          </CardContent>
        </Card>
      ) : remindersQuery.isError ? (
        <ErrorState
          action={
            <Button onClick={() => remindersQuery.refetch()} variant="secondary">
              Retry
            </Button>
          }
          description="The reminder list could not be loaded. Check that the API is running and try again."
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
          description="No reminders exist for this vehicle yet."
          title="No reminders yet"
        />
      )}
    </PageContainer>
  );
}
