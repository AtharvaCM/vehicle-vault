import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCatalogIntentPrefill } from '@/features/catalog-intent/hooks/use-catalog-intent-prefill';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

import { VehicleForm } from '../components/vehicle-form';
import { useCreateVehicle } from '../hooks/use-create-vehicle';
import type { VehicleFormValues } from '../schemas/vehicle-form.schema';

export function VehicleCreatePage() {
  const navigate = useNavigate();
  const { catalog } = useSearch({ from: '/app/vehicles/new' });
  const catalogIntent = useCatalogIntentPrefill(catalog);
  const [isDirty, setIsDirty] = useState(false);
  const createVehicleMutation = useCreateVehicle();
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved vehicle changes. Leave without saving?',
  });

  async function handleCreateVehicle(values: VehicleFormValues) {
    const prefill = catalogIntent.status === 'ready' ? catalogIntent.values : null;
    // Still the vehicle the intent named: re-picking the make or model makes it
    // a vehicle the visitor chose by hand.
    const fromCatalogIntent =
      prefill !== null && values.make === prefill.make && values.model === prefill.model;

    try {
      const vehicle = await createVehicleMutation.mutateAsync({
        ...values,
        ...(fromCatalogIntent ? { fromCatalogIntent: true } : {}),
      });
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
        {catalogIntent.status === 'resolving' ? (
          <LoadingState
            description="Filling in the vehicle you picked from the catalog."
            title="Loading vehicle"
          />
        ) : (
          <VehicleForm
            initialValues={catalogIntent.status === 'ready' ? catalogIntent.values : undefined}
            isSubmitting={createVehicleMutation.isPending}
            mode="create"
            onDirtyChange={setIsDirty}
            onSubmit={handleCreateVehicle}
            submitError={submitError}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>What to add first</CardTitle>
            <CardDescription>
              A few accurate basics make every later record easier to trust.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              Start with the current odometer so future due dates and due kilometres stay realistic.
            </p>
            <p>Use a nickname if you manage similar vehicles or a family garage.</p>
            <p>Once saved, you can begin logging services, reminders, and receipts.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
