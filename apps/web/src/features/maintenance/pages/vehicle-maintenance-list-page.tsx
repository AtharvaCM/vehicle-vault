import { Link } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { useMaintenanceRecords } from '../hooks/use-maintenance-records';
import { MaintenanceRecordList } from '../components/maintenance-record-list';

type VehicleMaintenanceListPageProps = {
  vehicleId: string;
};

export function VehicleMaintenanceListPage({ vehicleId }: VehicleMaintenanceListPageProps) {
  const vehicleQuery = useVehicle(vehicleId);
  const maintenanceQuery = useMaintenanceRecords(vehicleId);

  const vehicleTitle = vehicleQuery.data
    ? vehicleQuery.data.nickname?.trim() || `${vehicleQuery.data.make} ${vehicleQuery.data.model}`
    : 'Maintenance';
  const isVehicleNotFound =
    vehicleQuery.error instanceof ApiError && vehicleQuery.error.status === 404;
  const isMaintenanceVehicleNotFound =
    maintenanceQuery.error instanceof ApiError && maintenanceQuery.error.status === 404;

  if (isVehicleNotFound || isMaintenanceVehicleNotFound) {
    return (
      <PageContainer>
        <PageTitle
          description="Maintenance history is scoped to an existing vehicle record."
          title="Vehicle not found"
        />
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to Vehicles
            </Link>
          }
          description="The requested vehicle could not be found, so its maintenance history is unavailable."
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
              to="/vehicles/$vehicleId/maintenance/new"
            >
              Add Maintenance
            </Link>
          </div>
        }
        description="Maintenance records stay attached to a vehicle so its service history remains easy to review."
        title={`${vehicleTitle} Maintenance`}
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        {maintenanceQuery.isPending ? (
          <LoadingState
            description="Fetching maintenance records for this vehicle."
            title="Loading maintenance"
          />
        ) : maintenanceQuery.isError ? (
          <ErrorState
            action={
              <Button onClick={() => maintenanceQuery.refetch()} variant="secondary">
                Retry
              </Button>
            }
            description="The maintenance history could not be loaded. Check that the API is running and try again."
            title="Unable to load maintenance records"
          />
        ) : maintenanceQuery.data.length ? (
          <MaintenanceRecordList records={maintenanceQuery.data} />
        ) : (
          <EmptyState
            action={
              <Link
                className={buttonVariants()}
                params={{ vehicleId }}
                to="/vehicles/$vehicleId/maintenance/new"
              >
                Add the first maintenance record
              </Link>
            }
            description="No maintenance records exist for this vehicle yet."
            title="No maintenance records yet"
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Keep service history complete</CardTitle>
            <CardDescription>
              Use this view as the long-form history for one vehicle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Capture each completed service event with the odometer, cost, and workshop details.
            </p>
            <p>
              Open a record to manage receipts and documents for that specific maintenance event.
            </p>
            <p>Next-due fields stay useful here because they can inform reminder creation later.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
