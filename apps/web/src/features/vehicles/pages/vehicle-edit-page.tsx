import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

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
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

import { VehicleForm } from '../components/vehicle-form';
import { useUpdateVehicle } from '../hooks/use-update-vehicle';
import { useVehicle } from '../hooks/use-vehicle';

type VehicleEditPageProps = {
  vehicleId: string;
};

export function VehicleEditPage({ vehicleId }: VehicleEditPageProps) {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const vehicleQuery = useVehicle(vehicleId);
  const updateVehicleMutation = useUpdateVehicle(vehicleId);
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved vehicle edits. Leave without saving?',
  });
  const initialValues = useMemo(
    () =>
      vehicleQuery.data
        ? {
            registrationNumber: vehicleQuery.data.registrationNumber,
            make: vehicleQuery.data.make,
            model: vehicleQuery.data.model,
            variant: vehicleQuery.data.variant,
            year: vehicleQuery.data.year,
            vehicleType: vehicleQuery.data.vehicleType,
            fuelType: vehicleQuery.data.fuelType,
            odometer: vehicleQuery.data.odometer,
            nickname: vehicleQuery.data.nickname ?? '',
          }
        : undefined,
    [vehicleQuery.data],
  );

  async function handleUpdateVehicle(
    values: Parameters<typeof updateVehicleMutation.mutateAsync>[0],
  ) {
    try {
      await updateVehicleMutation.mutateAsync(values);
      const restoreNavigationGuard = allowNextNavigation();
      appToast.success({
        title: 'Vehicle updated',
        description: 'Vehicle details were saved.',
      });

      try {
        await navigate({
          to: '/vehicles/$vehicleId',
          params: {
            vehicleId,
          },
        });
      } catch (error) {
        restoreNavigationGuard();
        throw error;
      }
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
        <PageTitle description="Loading this vehicle before you edit it." title="Edit Vehicle" />
        <LoadingState
          description="Getting the latest vehicle details."
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
          description="You can only edit a vehicle that still exists."
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
            description="We couldn't load this vehicle. Try again in a moment."
            title="Unable to load vehicle"
          />
        )}
      </PageContainer>
    );
  }
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
        description="Update the details that identify this vehicle across your garage."
        title="Edit Vehicle"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <VehicleForm
          initialValues={initialValues}
          isSubmitting={updateVehicleMutation.isPending}
          onDirtyChange={setIsDirty}
          onSubmit={handleUpdateVehicle}
          submitError={
            updateVehicleMutation.error
              ? getApiErrorMessage(updateVehicleMutation.error, 'Unable to update the vehicle.')
              : null
          }
          submitHint="Keep the odometer and key details current so reminders stay accurate."
          submitLabel="Save Changes"
          submittingLabel="Saving changes..."
          successMessage="Vehicle details updated."
        />

        <Card>
          <CardHeader>
            <CardTitle>Keep details accurate</CardTitle>
            <CardDescription>Small changes here keep the rest of your records clear.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Update the odometer when you want kilometre-based reminders to stay trustworthy.</p>
            <p>Registration, make, model, and nickname help you recognise the right vehicle everywhere in the app.</p>
            <p>Use this page whenever ownership details or naming need cleanup.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
