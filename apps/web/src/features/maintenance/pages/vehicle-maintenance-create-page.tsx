import { Link, useNavigate } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { MaintenanceForm } from '../components/maintenance-form';
import { useCreateMaintenanceRecord } from '../hooks/use-create-maintenance-record';

type VehicleMaintenanceCreatePageProps = {
  vehicleId: string;
};

export function VehicleMaintenanceCreatePage({ vehicleId }: VehicleMaintenanceCreatePageProps) {
  const navigate = useNavigate();
  const vehicleQuery = useVehicle(vehicleId);
  const createMaintenanceMutation = useCreateMaintenanceRecord(vehicleId);

  async function handleCreateMaintenanceRecord(
    values: Parameters<typeof createMaintenanceMutation.mutateAsync>[0],
  ) {
    await createMaintenanceMutation.mutateAsync(values);

    await navigate({
      to: '/vehicles/$vehicleId/maintenance',
      params: {
        vehicleId,
      },
    });
  }

  const submitError =
    createMaintenanceMutation.error instanceof ApiError &&
    createMaintenanceMutation.error.data &&
    typeof createMaintenanceMutation.error.data === 'object' &&
    'error' in createMaintenanceMutation.error.data &&
    createMaintenanceMutation.error.data.error &&
    typeof createMaintenanceMutation.error.data.error === 'object' &&
    'message' in createMaintenanceMutation.error.data.error &&
    typeof createMaintenanceMutation.error.data.error.message === 'string'
      ? createMaintenanceMutation.error.data.error.message
      : (createMaintenanceMutation.error?.message ?? null);

  if (
    vehicleQuery.isError &&
    vehicleQuery.error instanceof ApiError &&
    vehicleQuery.error.status === 404
  ) {
    return (
      <PageContainer>
        <PageTitle
          description="Maintenance records can only be created for an existing vehicle."
          title="Vehicle not found"
        />
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to Vehicles
            </Link>
          }
          description="The requested vehicle could not be found, so a maintenance record cannot be created for it."
          title="Vehicle not found"
        />
      </PageContainer>
    );
  }

  const vehicleTitle = vehicleQuery.data
    ? vehicleQuery.data.nickname?.trim() || `${vehicleQuery.data.make} ${vehicleQuery.data.model}`
    : 'Vehicle';

  return (
    <PageContainer>
      <PageTitle
        description={`Record a real maintenance event for ${vehicleTitle} and persist it through the API.`}
        title="Add Maintenance Record"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <MaintenanceForm
          isSubmitting={createMaintenanceMutation.isPending}
          onSubmit={handleCreateMaintenanceRecord}
          submitError={submitError}
        />

        <Card>
          <CardHeader>
            <CardTitle>Data model notes</CardTitle>
            <CardDescription>Keep this form focused on one service event.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Workshop name is optional so roadside or self-performed work can still be recorded.
            </p>
            <p>
              Next due date and next due odometer are simple planning fields, not reminders yet.
            </p>
            <p>Persistence is still in-memory, so records reset when the API process restarts.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
