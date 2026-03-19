import { Link } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';

import { MaintenanceRecordCard } from '@/features/maintenance/components/maintenance-record-card';
import { useMaintenanceRecords } from '@/features/maintenance/hooks/use-maintenance-records';
import { ReminderCard } from '@/features/reminders/components/reminder-card';
import { useVehicleReminders } from '@/features/reminders/hooks/use-vehicle-reminders';
import { ReminderStatus } from '@vehicle-vault/shared';

import { VehicleSummaryCard } from '../components/vehicle-summary-card';
import { useVehicle } from '../hooks/use-vehicle';

type VehicleDetailPageProps = {
  vehicleId: string;
};

export function VehicleDetailPage({ vehicleId }: VehicleDetailPageProps) {
  const vehicleQuery = useVehicle(vehicleId);
  const maintenanceQuery = useMaintenanceRecords(vehicleId);
  const remindersQuery = useVehicleReminders(vehicleId);

  if (vehicleQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Loading the latest vehicle detail from the API."
          title="Vehicle Detail"
        />
        <LoadingState
          description="Fetching the vehicle record from the API."
          title="Loading vehicle"
        />
      </PageContainer>
    );
  }

  if (vehicleQuery.isError) {
    const isNotFound = vehicleQuery.error instanceof ApiError && vehicleQuery.error.status === 404;

    return (
      <PageContainer>
        <PageTitle
          description="Vehicle detail pages are driven by backend state."
          title={isNotFound ? 'Vehicle not found' : 'Unable to load vehicle'}
        />
        <ErrorState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to Vehicles
            </Link>
          }
          description={
            isNotFound
              ? 'The requested vehicle does not exist or may have been removed.'
              : 'The vehicle record could not be loaded. Check that the API is running and try again.'
          }
          title={isNotFound ? 'Vehicle not found' : 'Vehicle request failed'}
        />
      </PageContainer>
    );
  }

  const vehicle = vehicleQuery.data;
  const title = vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
  const activeReminders = (remindersQuery.data ?? []).filter(
    (reminder) => reminder.status !== ReminderStatus.Completed,
  );

  return (
    <PageContainer>
      <PageTitle
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId/maintenance"
            >
              View Maintenance
            </Link>
            <Link
              className={buttonVariants()}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId/maintenance/new"
            >
              Add Maintenance
            </Link>
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId/reminders"
            >
              View Reminders
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
        description="Use this page as the operational summary for one vehicle, with service history, reminders, and linked records in one place."
        title={title}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <VehicleSummaryCard vehicle={vehicle} />

        <Card>
          <CardHeader>
            <CardTitle>Recent maintenance</CardTitle>
            <CardDescription>
              Review the latest maintenance records linked to this vehicle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {maintenanceQuery.isPending ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading recent maintenance records.
              </p>
            ) : maintenanceQuery.isError ? (
              <EmptyState
                description="Recent maintenance could not be loaded right now."
                title="Unable to load recent maintenance"
              />
            ) : maintenanceQuery.data.length ? (
              <div className="space-y-3">
                {maintenanceQuery.data.slice(0, 3).map((record) => (
                  <MaintenanceRecordCard key={record.id} record={record} />
                ))}
              </div>
            ) : (
              <EmptyState
                action={
                  <Link
                    className={buttonVariants()}
                    params={{ vehicleId }}
                    to="/vehicles/$vehicleId/maintenance/new"
                  >
                    Add first maintenance record
                  </Link>
                }
                description="No maintenance records exist for this vehicle yet."
                title="No maintenance records yet"
              />
            )}

            <div className="flex gap-3">
              <Link
                className={buttonVariants({ size: 'sm', variant: 'secondary' })}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId/maintenance"
              >
                View All Maintenance
              </Link>
              <Link
                className={buttonVariants({ size: 'sm' })}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId/maintenance/new"
              >
                Add Maintenance
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming reminders</CardTitle>
            <CardDescription>
              Review the next reminder items linked to this vehicle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {remindersQuery.isPending ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Loading reminder summary.
              </p>
            ) : remindersQuery.isError ? (
              <EmptyState
                description="Upcoming reminders could not be loaded right now."
                title="Unable to load reminders"
              />
            ) : activeReminders.length ? (
              <div className="space-y-3">
                {activeReminders.slice(0, 3).map((reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} />
                ))}
              </div>
            ) : (
              <EmptyState
                action={
                  <Link
                    className={buttonVariants()}
                    params={{ vehicleId }}
                    to="/vehicles/$vehicleId/reminders/new"
                  >
                    Add first reminder
                  </Link>
                }
                description="No reminders exist for this vehicle yet."
                title="No reminders yet"
              />
            )}

            <div className="flex gap-3">
              <Link
                className={buttonVariants({ size: 'sm', variant: 'secondary' })}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId/reminders"
              >
                View All Reminders
              </Link>
              <Link
                className={buttonVariants({ size: 'sm' })}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId/reminders/new"
              >
                Add Reminder
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
