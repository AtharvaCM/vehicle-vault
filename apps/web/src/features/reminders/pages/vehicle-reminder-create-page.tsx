import { Link, useNavigate } from '@tanstack/react-router';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
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
    try {
      const reminder = await createReminderMutation.mutateAsync(values);
      appToast.success({
        title: 'Reminder created',
        description: 'The reminder is now active for this vehicle.',
      });

      await navigate({
        to: '/reminders/$reminderId',
        params: {
          reminderId: reminder.id,
        },
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to create reminder',
        description: getApiErrorMessage(error, 'Unable to create the reminder.'),
      });
      throw error;
    }
  }

  const submitError = createReminderMutation.error
    ? getApiErrorMessage(createReminderMutation.error, 'Unable to create the reminder.')
    : null;

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
            <p>Reminder records are now persisted through Prisma into PostgreSQL.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
