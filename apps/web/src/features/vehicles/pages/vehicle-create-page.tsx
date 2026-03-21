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
        description: 'You can now add maintenance history, reminders, and receipts.',
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
        description="Add a car or bike so you can track its maintenance, reminders, and documents."
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
            <CardTitle>What to add first</CardTitle>
            <CardDescription>A few accurate basics make every later record easier to trust.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Start with the current odometer so future due dates and due kilometres stay realistic.</p>
            <p>Use a nickname if you manage similar vehicles or a family garage.</p>
            <p>Once saved, you can begin logging services, reminders, and receipts.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
