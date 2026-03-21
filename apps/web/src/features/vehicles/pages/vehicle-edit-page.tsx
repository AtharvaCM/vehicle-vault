import { Link, useNavigate } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { VehicleForm } from '../components/vehicle-form';
import { useUpdateVehicle } from '../hooks/use-update-vehicle';
import { useVehicle } from '../hooks/use-vehicle';

type VehicleEditPageProps = {
  vehicleId: string;
};

export function VehicleEditPage({ vehicleId }: VehicleEditPageProps) {
  const navigate = useNavigate();
  const vehicleQuery = useVehicle(vehicleId);
  const updateVehicleMutation = useUpdateVehicle(vehicleId);

  async function handleUpdateVehicle(
    values: Parameters<typeof updateVehicleMutation.mutateAsync>[0],
  ) {
    try {
      await updateVehicleMutation.mutateAsync(values);
      appToast.success({
        title: 'Vehicle updated',
        description: 'Vehicle details were saved successfully.',
      });

      await navigate({
        to: '/vehicles/$vehicleId',
        params: {
          vehicleId,
        },
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to update vehicle',
        description: getApiErrorMessage(error, 'Unable to update the vehicle.'),
      });
      throw error;
    }
  }

  if (vehicleQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle description="Loading the current vehicle before editing." title="Edit Vehicle" />
        <LoadingState
          description="Fetching the latest vehicle values from the API."
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
          description="Vehicle edits require an existing vehicle record."
          title={isNotFound ? 'Vehicle not found' : 'Unable to load vehicle'}
        />
        {isNotFound ? (
          <EmptyState
            action={
              <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
                Back to Vehicles
              </Link>
            }
            description="The requested vehicle could not be found, so it cannot be edited."
            title="Vehicle not found"
          />
        ) : (
          <ErrorState
            action={
              <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
                Back to Vehicles
              </Link>
            }
            description="The vehicle record could not be loaded. Check the API and try again."
            title="Unable to load vehicle"
          />
        )}
      </PageContainer>
    );
  }

  const vehicle = vehicleQuery.data;

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link
            className={buttonVariants({ variant: 'secondary' })}
            params={{ vehicleId }}
            to="/vehicles/$vehicleId"
          >
            Back to Vehicle
          </Link>
        }
        description="Update the vehicle record without leaving the shared data contract used across the app."
        title="Edit Vehicle"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <VehicleForm
          initialValues={{
            registrationNumber: vehicle.registrationNumber,
            make: vehicle.make,
            model: vehicle.model,
            variant: vehicle.variant,
            year: vehicle.year,
            vehicleType: vehicle.vehicleType,
            fuelType: vehicle.fuelType,
            odometer: vehicle.odometer,
            nickname: vehicle.nickname ?? '',
          }}
          isSubmitting={updateVehicleMutation.isPending}
          onSubmit={handleUpdateVehicle}
          submitError={
            updateVehicleMutation.error
              ? getApiErrorMessage(updateVehicleMutation.error, 'Unable to update the vehicle.')
              : null
          }
          submitHint="Vehicle edits are persisted immediately and refresh downstream reminder calculations."
          submitLabel="Save Changes"
          submittingLabel="Saving changes..."
          successMessage="Vehicle updated successfully."
        />

        <Card>
          <CardHeader>
            <CardTitle>Edit guidance</CardTitle>
            <CardDescription>Keep vehicle data clean because other features depend on it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Odometer updates affect reminder urgency when reminders depend on due odometer.</p>
            <p>Registration, make, and model stay visible across lists, dashboard summaries, and records.</p>
            <p>Changes are stored in PostgreSQL through the same API contract used on create.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
