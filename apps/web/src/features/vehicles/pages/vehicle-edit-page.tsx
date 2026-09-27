import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { toDateInputValue } from '@/lib/utils/to-date-input-value';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

import { ViewOnlyNotice } from '../components/view-only-notice';
import { VehicleForm } from '../components/vehicle-form';
import { accessFor, VehicleAccessProvider } from '../context/vehicle-access';
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
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);
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
            // The date input only accepts `yyyy-MM-dd`; a full ISO instant
            // fails its sanitization and renders blank instead of prefilled.
            purchaseDate: toDateInputValue(vehicleQuery.data.purchaseDate ?? undefined),
            purchasePrice: vehicleQuery.data.purchasePrice ?? null,
            purchaseOdometer: vehicleQuery.data.purchaseOdometer ?? null,
            engineOilGrade: vehicleQuery.data.engineOilGrade ?? null,
            engineOilLitres: vehicleQuery.data.engineOilLitres ?? null,
          }
        : undefined,
    [vehicleQuery.data],
  );

  async function handleUpdateVehicle(
    values: Parameters<typeof updateVehicleMutation.mutateAsync>[0],
  ) {
    // The form only sends what changed, so a save with nothing touched sends
    // an empty body. VehicleUpdateSchema refuses that ("at least one field"),
    // and there is nothing to write anyway: treat it as a no-op success
    // rather than calling the API.
    const hasChanges = Object.keys(values).length > 0;

    try {
      if (hasChanges) {
        await updateVehicleMutation.mutateAsync(values);
      }
      const restoreNavigationGuard = allowNextNavigation();
      appToast.success(
        hasChanges
          ? { title: 'Vehicle updated', description: 'Vehicle details were saved.' }
          : { title: 'No changes to save', description: 'Nothing on this vehicle changed.' },
      );

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
        <PageTitle description="Loading this vehicle before you edit it." title="Edit vehicle" />
        <LoadingState description="Getting the latest vehicle details." title="Loading vehicle" />
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
              <Link className={buttonVariants({ variant: 'secondary' })} to="/garage">
                Back to Garage
              </Link>
            }
            description="The requested vehicle could not be found, so it cannot be edited."
            title="Vehicle not found"
          />
        ) : (
          <ErrorState
            action={
              <Link className={buttonVariants({ variant: 'secondary' })} to="/garage">
                Back to Garage
              </Link>
            }
            description="We couldn't load this vehicle. Try again in a moment."
            title="Unable to load vehicle"
          />
        )}
      </PageContainer>
    );
  }

  if (!canEdit) {
    return (
      <PageContainer>
        <PageTitle
          actions={
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId"
            >
              Back to vehicle
            </Link>
          }
          description="This vehicle is shared with you for reading."
          title="Edit vehicle"
        />
        <ViewOnlyNotice description="You can see this vehicle but not change its registration, odometer, or other details." />
      </PageContainer>
    );
  }

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <PageContainer className="max-w-3xl">
        <PageTitle
          description="Changes apply everywhere this vehicle appears."
          title="Edit vehicle"
        />

        <VehicleForm
          cancel={
            <Link
              className={buttonVariants({ variant: 'ghost', size: 'lg' })}
              params={{ vehicleId }}
              to="/vehicles/$vehicleId"
            >
              Cancel
            </Link>
          }
          initialValues={initialValues}
          isSubmitting={updateVehicleMutation.isPending}
          mode="edit"
          onDirtyChange={setIsDirty}
          onSubmit={handleUpdateVehicle}
          submitError={
            updateVehicleMutation.error
              ? getApiErrorMessage(updateVehicleMutation.error, 'Unable to update the vehicle.')
              : null
          }
          submitLabel="Save changes"
          submittingLabel="Saving changes..."
          successMessage="Vehicle details updated."
        />
      </PageContainer>
    </VehicleAccessProvider>
  );
}
