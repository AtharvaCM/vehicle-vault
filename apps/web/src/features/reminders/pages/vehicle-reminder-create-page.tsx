import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { ViewOnlyNotice } from '@/features/vehicles/components/view-only-notice';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { ReminderForm } from '../components/reminder-form';
import { useCreateReminder } from '../hooks/use-create-reminder';

type VehicleReminderCreatePageProps = {
  vehicleId: string;
};

export function VehicleReminderCreatePage({ vehicleId }: VehicleReminderCreatePageProps) {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const vehicleQuery = useVehicle(vehicleId);
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);
  const createReminderMutation = useCreateReminder(vehicleId);
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved reminder details. Leave without saving?',
  });

  async function handleCreateReminder(
    values: Parameters<typeof createReminderMutation.mutateAsync>[0],
  ) {
    try {
      const reminder = await createReminderMutation.mutateAsync(values);
      const restoreNavigationGuard = allowNextNavigation();
      appToast.success({
        title: 'Reminder created',
        description: 'The reminder is now active for this vehicle.',
      });

      try {
        await navigate({
          to: '/reminders/$reminderId',
          params: {
            reminderId: reminder.id,
          },
        });
      } catch (error) {
        restoreNavigationGuard();
        throw error;
      }
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
            <Link className={buttonVariants({ variant: 'secondary' })} to="/garage">
              Back to Garage
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

  if (!canEdit) {
    return (
      <PageContainer>
        <PageTitle
          description={`${vehicleTitle} is shared with you for reading.`}
          title="Add reminder"
        />
        <ViewOnlyNotice
          action={
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId }}
              search={{ tab: 'reminders' }}
              to="/vehicles/$vehicleId"
            >
              Back to Reminders
            </Link>
          }
          description="You can read this vehicle's reminders, but not create new ones for it."
        />
      </PageContainer>
    );
  }

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <PageContainer className="max-w-3xl">
        <PageTitle
          description={`For ${vehicleTitle}: due by a date, a reading, or whichever comes first.`}
          title="Add reminder"
        />

        <p className="text-ui text-fg-3">
          Not sure what it needs?{' '}
          <Link
            className="font-semibold text-brand underline-offset-4 hover:underline"
            params={{ vehicleId }}
            search={{ tab: 'reminders' }}
            to="/vehicles/$vehicleId"
          >
            Pick from the suggested service schedule
          </Link>
        </p>

        <ReminderForm
          cancel={
            <Link
              className={buttonVariants({ variant: 'ghost', size: 'lg' })}
              params={{ vehicleId }}
              search={{ tab: 'reminders' }}
              to="/vehicles/$vehicleId"
            >
              Cancel
            </Link>
          }
          isSubmitting={createReminderMutation.isPending}
          onDirtyChange={setIsDirty}
          onSubmit={handleCreateReminder}
          submitError={submitError}
        />
      </PageContainer>
    </VehicleAccessProvider>
  );
}
