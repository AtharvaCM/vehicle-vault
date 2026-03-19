import { Link } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';

import { ReminderList } from '../components/reminder-list';
import { useReminders } from '../hooks/use-reminders';
import { groupRemindersByStatus } from '../utils/group-reminders-by-status';

export function RemindersPage() {
  const remindersQuery = useReminders();
  const vehiclesQuery = useVehicles();

  const vehicleLabelById = Object.fromEntries(
    (vehiclesQuery.data ?? []).map((vehicle) => [
      vehicle.id,
      `${vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`} • ${vehicle.registrationNumber}`,
    ]),
  );

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
            Add Reminder From Vehicle
          </Link>
        }
        description="Review reminders across vehicles, grouped by status so overdue and due-today items stay obvious."
        title="Reminders"
      />

      {remindersQuery.isPending ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading reminders</CardTitle>
            <CardDescription>Fetching reminder records from the API.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Please wait while the reminder list loads.
          </CardContent>
        </Card>
      ) : remindersQuery.isError ? (
        <EmptyState
          description="The reminder list could not be loaded. Make sure the API is running and reachable from the frontend."
          title="Unable to load reminders"
        />
      ) : remindersQuery.data.length ? (
        <div className="grid gap-6">
          <ReminderList
            description="Items that need attention immediately."
            emptyMessage="No overdue reminders."
            reminders={groupRemindersByStatus(remindersQuery.data)[ReminderStatus.Overdue]}
            title="Overdue"
            vehicleLabelById={vehicleLabelById}
          />
          <ReminderList
            description="Items that become due today."
            emptyMessage="No reminders are due today."
            reminders={groupRemindersByStatus(remindersQuery.data)[ReminderStatus.DueToday]}
            title="Due Today"
            vehicleLabelById={vehicleLabelById}
          />
          <ReminderList
            description="Upcoming reminders that should stay visible."
            emptyMessage="No upcoming reminders."
            reminders={groupRemindersByStatus(remindersQuery.data)[ReminderStatus.Upcoming]}
            title="Upcoming"
            vehicleLabelById={vehicleLabelById}
          />
          <ReminderList
            description="Completed reminders kept for reference."
            emptyMessage="No completed reminders yet."
            reminders={groupRemindersByStatus(remindersQuery.data)[ReminderStatus.Completed]}
            title="Completed"
            vehicleLabelById={vehicleLabelById}
          />
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
