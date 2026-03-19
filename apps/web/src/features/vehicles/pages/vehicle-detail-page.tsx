import { Link } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';

import { VehicleSummaryCard } from '../components/vehicle-summary-card';
import { useVehicle } from '../hooks/use-vehicle';

type VehicleDetailPageProps = {
  vehicleId: string;
};

export function VehicleDetailPage({ vehicleId }: VehicleDetailPageProps) {
  const vehicleQuery = useVehicle(vehicleId);

  if (vehicleQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle
          description="Loading the latest vehicle detail from the API."
          title="Vehicle Detail"
        />
        <Card>
          <CardHeader>
            <CardTitle>Loading vehicle</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Please wait while the vehicle record is fetched.
          </CardContent>
        </Card>
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
        <EmptyState
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

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link
            className={buttonVariants({ variant: 'secondary' })}
            params={{ vehicleId }}
            to="/vehicles/$vehicleId/maintenance"
          >
            View Maintenance
          </Link>
        }
        description="Vehicle detail pages should become the entry point for documents, maintenance, reminders, and timeline activity tied to one vehicle."
        title={title}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <VehicleSummaryCard vehicle={vehicle} />

        <Card>
          <CardHeader>
            <CardTitle>Maintenance overview</CardTitle>
            <CardDescription>
              Maintenance CRUD is intentionally outside this slice, but this section is ready for
              that data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Add and review maintenance records for this vehicle from the next MVP slice.
            </p>
            <Link
              className={buttonVariants({ size: 'sm', variant: 'secondary' })}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId/maintenance/new"
            >
              Add Maintenance
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reminders overview</CardTitle>
            <CardDescription>
              Reminder summaries will be connected here once reminder queries are implemented.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              No reminder integration is wired in this slice yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
