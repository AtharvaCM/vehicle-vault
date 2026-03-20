import { Link } from '@tanstack/react-router';
import { BellRing, ClipboardList, LayoutGrid } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
              to="/vehicles/$vehicleId/edit"
            >
              Edit Vehicle
            </Link>
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

      <Tabs className="space-y-6" defaultValue="overview">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-white p-1 shadow-sm sm:max-w-xl">
          <TabsTrigger className="gap-2 py-2.5" value="overview">
            <LayoutGrid className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger className="gap-2 py-2.5" value="maintenance">
            <ClipboardList className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger className="gap-2 py-2.5" value="reminders">
            <BellRing className="h-4 w-4" />
            Reminders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <VehicleSummaryCard vehicle={vehicle} />
            <Card>
              <CardHeader>
                <CardTitle>Operational snapshot</CardTitle>
                <CardDescription>
                  Use this as the fast read before diving into detailed maintenance or reminders.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <SnapshotMetric
                  label="Maintenance records"
                  value={
                    maintenanceQuery.isSuccess ? String(maintenanceQuery.data.length) : 'Loading'
                  }
                />
                <SnapshotMetric
                  label="Active reminders"
                  value={remindersQuery.isSuccess ? String(activeReminders.length) : 'Loading'}
                />
                <SnapshotMetric
                  label="Current odometer"
                  value={`${vehicle.odometer.toLocaleString('en-IN')} km`}
                />
                <SnapshotMetric label="Vehicle type" value={vehicle.vehicleType} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <MaintenancePanel maintenanceQuery={maintenanceQuery} vehicleId={vehicleId} />
            <ReminderPanel
              remindersQuery={remindersQuery}
              vehicleId={vehicleId}
              visibleReminders={activeReminders}
            />
          </div>
        </TabsContent>

        <TabsContent value="maintenance">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <MaintenancePanel
              maintenanceQuery={maintenanceQuery}
              title="Maintenance history"
              vehicleId={vehicleId}
              visibleCount={undefined}
            />
            <Card>
              <CardHeader>
                <CardTitle>Service workflow</CardTitle>
                <CardDescription>
                  Keep each maintenance event specific, documented, and easy to revisit later.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Log each service event against the odometer so history stays trustworthy.</p>
                <p>Open any maintenance record to manage receipts and uploaded documents.</p>
                <p>
                  Use next-due fields to keep future service planning visible in the reminders
                  workspace.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reminders">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <ReminderPanel
              remindersQuery={remindersQuery}
              title="Reminder queue"
              vehicleId={vehicleId}
              visibleCount={undefined}
              visibleReminders={activeReminders}
            />
            <Card>
              <CardHeader>
                <CardTitle>Reminder workflow</CardTitle>
                <CardDescription>
                  Keep upcoming due items visible before they become missed tasks.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Create reminders with either a due date, due odometer, or both.</p>
                <p>Overdue and due-today items surface across the dashboard and reminders center.</p>
                <p>Completed reminders remain available for reference without cluttering action lists.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

type SnapshotMetricProps = {
  label: string;
  value: string;
};

function SnapshotMetric({ label, value }: SnapshotMetricProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

type MaintenancePanelProps = {
  vehicleId: string;
  maintenanceQuery: ReturnType<typeof useMaintenanceRecords>;
  title?: string;
  visibleCount?: number | undefined;
};

function MaintenancePanel({
  vehicleId,
  maintenanceQuery,
  title = 'Recent maintenance',
  visibleCount = 3,
}: MaintenancePanelProps) {
  const records =
    visibleCount === undefined ? (maintenanceQuery.data ?? []) : (maintenanceQuery.data ?? []).slice(0, visibleCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Review the latest maintenance records linked to this vehicle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {maintenanceQuery.isPending ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Loading maintenance records.
          </p>
        ) : maintenanceQuery.isError ? (
          <EmptyState
            description="Maintenance history could not be loaded right now."
            title="Unable to load maintenance"
          />
        ) : records.length ? (
          <div className="space-y-3">
            {records.map((record) => (
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

        <div className="flex flex-wrap gap-3">
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
  );
}

type ReminderPanelProps = {
  vehicleId: string;
  remindersQuery: ReturnType<typeof useVehicleReminders>;
  visibleReminders: ReturnType<typeof useVehicleReminders>['data'];
  title?: string;
  visibleCount?: number | undefined;
};

function ReminderPanel({
  vehicleId,
  remindersQuery,
  visibleReminders,
  title = 'Upcoming reminders',
  visibleCount = 3,
}: ReminderPanelProps) {
  const reminders =
    visibleCount === undefined
      ? (visibleReminders ?? [])
      : (visibleReminders ?? []).slice(0, visibleCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Review the next reminder items linked to this vehicle.</CardDescription>
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
        ) : reminders.length ? (
          <div className="space-y-3">
            {reminders.map((reminder) => (
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

        <div className="flex flex-wrap gap-3">
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
  );
}
