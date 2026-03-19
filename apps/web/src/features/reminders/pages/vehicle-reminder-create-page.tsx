import { Link, useNavigate } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { ReminderForm } from '../components/reminder-form';
import { useCreateReminder } from '../hooks/use-create-reminder';

type VehicleReminderCreatePageProps = {
  vehicleId: string;
};

export function VehicleReminderCreatePage({ vehicleId }: VehicleReminderCreatePageProps) {
  const navigate = useNavigate();
  const vehicleQuery = useVehicle(vehicleId);
  const createReminderMutation = useCreateReminder(vehicleId);

  async function handleCreateReminder(
    values: Parameters<typeof createReminderMutation.mutateAsync>[0],
  ) {
    const reminder = await createReminderMutation.mutateAsync(values);

    await navigate({
      to: '/reminders/$reminderId',
      params: {
        reminderId: reminder.id,
      },
    });
  }

  const submitError =
    createReminderMutation.error instanceof ApiError &&
    createReminderMutation.error.data &&
    typeof createReminderMutation.error.data === 'object' &&
    'error' in createReminderMutation.error.data &&
    createReminderMutation.error.data.error &&
    typeof createReminderMutation.error.data.error === 'object' &&
    'message' in createReminderMutation.error.data.error &&
    typeof createReminderMutation.error.data.error.message === 'string'
      ? createReminderMutation.error.data.error.message
      : (createReminderMutation.error?.message ?? null);

  if (
    vehicleQuery.isError &&
    vehicleQuery.error instanceof ApiError &&
    vehicleQuery.error.status === 404
  ) {
    return (
      <PageContainer>
        <PageTitle
          description="Reminders can only be created for an existing vehicle."
          title="Vehicle not found"
        />
        <EmptyState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/vehicles">
              Back to Vehicles
            </Link>
          }
          description="The requested vehicle could not be found, so a reminder cannot be created for it."
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
        description={`Create a real reminder for ${vehicleTitle} and persist it through the API.`}
        title="Add Reminder"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ReminderForm
          isSubmitting={createReminderMutation.isPending}
          onSubmit={handleCreateReminder}
          submitError={submitError}
        />

        <Card>
          <CardHeader>
            <CardTitle>Reminder notes</CardTitle>
            <CardDescription>Keep this slice focused on reminder data only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              No delivery or scheduling logic is wired yet. This is only the reminder record and
              status flow.
            </p>
            <p>
              Use a due date, a due odometer, or both. When both exist, the more urgent condition
              wins.
            </p>
            <p>Persistence is still in-memory, so reminders reset when the API process restarts.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
