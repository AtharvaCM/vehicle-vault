import { useNavigate } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';

import { VehicleForm } from '../components/vehicle-form';
import { useCreateVehicle } from '../hooks/use-create-vehicle';

export function VehicleCreatePage() {
  const navigate = useNavigate();
  const createVehicleMutation = useCreateVehicle();

  async function handleCreateVehicle(
    values: Parameters<typeof createVehicleMutation.mutateAsync>[0],
  ) {
    const vehicle = await createVehicleMutation.mutateAsync(values);

    await navigate({
      to: '/vehicles/$vehicleId',
      params: {
        vehicleId: vehicle.id,
      },
    });
  }

  const submitError =
    createVehicleMutation.error instanceof ApiError &&
    createVehicleMutation.error.data &&
    typeof createVehicleMutation.error.data === 'object' &&
    'error' in createVehicleMutation.error.data &&
    createVehicleMutation.error.data.error &&
    typeof createVehicleMutation.error.data.error === 'object' &&
    'message' in createVehicleMutation.error.data.error &&
    typeof createVehicleMutation.error.data.error.message === 'string'
      ? createVehicleMutation.error.data.error.message
      : (createVehicleMutation.error?.message ?? null);

  return (
    <PageContainer>
      <PageTitle
        description="Create a real vehicle record through the API, then continue directly into the vehicle detail flow."
        title="Add Vehicle"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <VehicleForm
          isSubmitting={createVehicleMutation.isPending}
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
            <p>Persistence is still in-memory, so records reset when the API process restarts.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
