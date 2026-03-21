import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

import { VehicleForm } from '../components/vehicle-form';
import { useCreateVehicle } from '../hooks/use-create-vehicle';

export function VehicleCreatePage() {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const createVehicleMutation = useCreateVehicle();
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved vehicle changes. Leave without saving?',
  });

  async function handleCreateVehicle(
    values: Parameters<typeof createVehicleMutation.mutateAsync>[0],
  ) {
    try {
      const vehicle = await createVehicleMutation.mutateAsync(values);
      const restoreNavigationGuard = allowNextNavigation();

      appToast.success({
        title: 'Vehicle created',
        description: 'The vehicle is ready for maintenance, reminders, and receipts.',
      });

      try {
        await navigate({
          to: '/vehicles/$vehicleId',
          params: {
            vehicleId: vehicle.id,
          },
        });
      } catch (error) {
        restoreNavigationGuard();
        throw error;
      }
    } catch (error) {
      appToast.error({
        title: 'Unable to create vehicle',
        description: getApiErrorMessage(error, 'Unable to create the vehicle.'),
      });
      throw error;
    }
  }

  const submitError = createVehicleMutation.error
    ? getApiErrorMessage(createVehicleMutation.error, 'Unable to create the vehicle.')
    : null;

  return (
    <PageContainer>
      <PageTitle
        description="Create a real vehicle record through the API, then continue directly into the vehicle detail flow."
        title="Add Vehicle"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <VehicleForm
          isSubmitting={createVehicleMutation.isPending}
          onDirtyChange={setIsDirty}
          onSubmit={handleCreateVehicle}
          submitError={submitError}
        />

        <Card>
          <CardHeader>
            <CardTitle>Implementation notes</CardTitle>
            <CardDescription>Recommended next steps for this form.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Submission is wired to a real mutation against the Nest API.</p>
            <p>The vehicles query cache is invalidated automatically after a successful create.</p>
            <p>Vehicle records are now persisted through Prisma into PostgreSQL.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
