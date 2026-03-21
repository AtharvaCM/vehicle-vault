import { Link } from '@tanstack/react-router';
import { BellRing, ClipboardList, LayoutGrid } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { MaintenanceRecordCard } from '@/features/maintenance/components/maintenance-record-card';
import { useMaintenanceRecords } from '@/features/maintenance/hooks/use-maintenance-records';
import { ReminderCard } from '@/features/reminders/components/reminder-card';
import { useVehicleReminders } from '@/features/reminders/hooks/use-vehicle-reminders';
import { ReminderStatus } from '@vehicle-vault/shared';
import { useNavigate } from '@tanstack/react-router';

import { OdometerHistoryCard } from '../components/odometer-history-card';
import { ServiceTrendCard } from '../components/service-trend-card';
import { VehicleSummaryCard } from '../components/vehicle-summary-card';
import { useDeleteVehicle } from '../hooks/use-delete-vehicle';
import { useVehicle } from '../hooks/use-vehicle';
import { getVehicleServiceInsights } from '../utils/get-vehicle-service-insights';

type VehicleDetailPageProps = {
  vehicleId: string;
};

export function VehicleDetailPage({ vehicleId }: VehicleDetailPageProps) {
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const vehicleQuery = useVehicle(vehicleId);
  const maintenanceQuery = useMaintenanceRecords(vehicleId);
  const remindersQuery = useVehicleReminders(vehicleId);
  const deleteVehicleMutation = useDeleteVehicle();
  const vehicle = vehicleQuery.data ?? null;
  const serviceInsights = useMemo(
    () =>
      vehicle
        ? getVehicleServiceInsights({
            vehicle,
            records: maintenanceQuery.data ?? [],
          })
        : null,
    [maintenanceQuery.data, vehicle],
  );

  async function handleDeleteVehicle() {
    try {
      setActionError(null);
      await deleteVehicleMutation.mutateAsync(vehicleId);
      appToast.success({
        title: 'Vehicle deleted',
        description: 'The vehicle and its linked history were removed.',
      });
      await navigate({ to: '/vehicles' });
    } catch (error) {
      appToast.error({
        title: 'Unable to delete vehicle',
        description: getApiErrorMessage(error, 'Unable to delete the vehicle.'),
      });
      setActionError(getApiErrorMessage(error, 'Unable to delete the vehicle.'));
    }
  }

  if (vehicleQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Loading this vehicle and its latest activity."
          title="Vehicle Detail"
        />
        <LoadingState
          description="Getting this vehicle ready."
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
          description="Review one vehicle's details, service history, reminders, and receipts in one place."
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
              : "We couldn't load this vehicle. Try again in a moment."
          }
          title={isNotFound ? 'Vehicle not found' : 'Vehicle request failed'}
        />
      </PageContainer>
    );
  }

  if (!vehicle || !serviceInsights) {
    return null;
  }

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
            <ConfirmActionDialog
              confirmLabel="Delete vehicle"
              description="This removes the vehicle, its maintenance history, reminders, and attachment details. This can't be undone."
              isPending={deleteVehicleMutation.isPending}
              onConfirm={handleDeleteVehicle}
              title="Delete this vehicle?"
              triggerLabel="Delete Vehicle"
              triggerVariant="secondary"
            />
          </div>
        }
        description="See this vehicle's details, service history, reminders, and receipts in one place."
        title={title}
      />

      {actionError ? <InlineError message={actionError} /> : null}

      <Tabs className="space-y-6" defaultValue="overview">
        <TabsList className="flex h-auto w-full flex-wrap rounded-2xl bg-white p-1 shadow-sm sm:w-auto">
          <TabsTrigger className="min-w-[120px] flex-1 gap-2 py-2.5 sm:flex-none" value="overview">
            <LayoutGrid className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            className="min-w-[120px] flex-1 gap-2 py-2.5 sm:flex-none"
            value="maintenance"
          >
            <ClipboardList className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger className="min-w-[120px] flex-1 gap-2 py-2.5 sm:flex-none" value="reminders">
            <BellRing className="h-4 w-4" />
            Reminders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <VehicleSummaryCard vehicle={vehicle} />
            <Card>
              <CardHeader>
                <CardTitle>At a glance</CardTitle>
                <CardDescription>
                  Start here for the quickest view of this vehicle today.
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

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <OdometerHistoryCard insights={serviceInsights} />
            <ServiceTrendCard insights={serviceInsights} />
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
                <CardTitle>Keep service history useful</CardTitle>
                <CardDescription>
                  Good service notes are easier to trust later.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Log each visit or repair with the odometer so the timeline stays accurate.</p>
                <p>Open a service entry to attach receipts, invoices, or photos.</p>
                <p>Use next due fields to capture what should happen next.</p>
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
                <CardTitle>Stay ahead of upcoming work</CardTitle>
                <CardDescription>
                  Use reminders to keep important dates and kilometre targets visible.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Set a due date, a due odometer, or both depending on the job.</p>
                <p>Overdue and due today reminders show up on the dashboard and reminder lists.</p>
                <p>Completed reminders stay in history for reference.</p>
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
        <CardDescription>Recent service entries for this vehicle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {maintenanceQuery.isPending ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Loading service history.
          </p>
        ) : maintenanceQuery.isError ? (
          <EmptyState
            description="Service history couldn't be loaded right now."
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
            description="No service entries have been logged for this vehicle yet."
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
        <CardDescription>Active reminders linked to this vehicle.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {remindersQuery.isPending ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Loading reminders.
          </p>
        ) : remindersQuery.isError ? (
          <EmptyState
            description="Reminders couldn't be loaded right now."
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
            description="No reminders have been created for this vehicle yet."
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
