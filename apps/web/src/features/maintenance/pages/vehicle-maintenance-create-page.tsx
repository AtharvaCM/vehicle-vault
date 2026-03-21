import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { MaintenanceForm } from '../components/maintenance-form';
import { useCreateMaintenanceRecord } from '../hooks/use-create-maintenance-record';

type VehicleMaintenanceCreatePageProps = {
  vehicleId: string;
};

export function VehicleMaintenanceCreatePage({ vehicleId }: VehicleMaintenanceCreatePageProps) {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const vehicleQuery = useVehicle(vehicleId);
  const createMaintenanceMutation = useCreateMaintenanceRecord(vehicleId);
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved maintenance details. Leave without saving?',
  });

  async function handleCreateMaintenanceRecord(
    values: Parameters<typeof createMaintenanceMutation.mutateAsync>[0],
  ) {
    try {
      await createMaintenanceMutation.mutateAsync(values);
      const restoreNavigationGuard = allowNextNavigation();
      appToast.success({
        title: 'Maintenance record created',
        description: 'The service event was added to this vehicle.',
      });

      try {
        await navigate({
          to: '/vehicles/$vehicleId/maintenance',
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
        title: 'Unable to create maintenance record',
        description: getApiErrorMessage(error, 'Unable to create the maintenance record.'),
      });
      throw error;
    }
  }

  const submitError = createMaintenanceMutation.error
    ? getApiErrorMessage(
        createMaintenanceMutation.error,
        'Unable to create the maintenance record.',
      )
    : null;

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
          onDirtyChange={setIsDirty}
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
            <p>Maintenance records are now persisted through Prisma into PostgreSQL.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
