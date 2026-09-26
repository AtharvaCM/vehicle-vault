import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { ViewOnlyNotice } from '@/features/vehicles/components/view-only-notice';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';
import { ApiError } from '@/lib/api/api-error';
import { documentKindTitles } from '@/features/vehicle-documents/utils/document-kind-labels';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { toDateInputValue } from '@/lib/utils/to-date-input-value';

import { ReminderForm } from '../components/reminder-form';
import { useReminder } from '../hooks/use-reminder';
import { useUpdateReminder } from '../hooks/use-update-reminder';
import { toRepeatChoice } from '../utils/repeat-rule';

type ReminderEditPageProps = {
  reminderId: string;
};

export function ReminderEditPage({ reminderId }: ReminderEditPageProps) {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const reminderQuery = useReminder(reminderId);
  const updateReminderMutation = useUpdateReminder(reminderId);
  // The reminder names its vehicle, and the vehicle carries the caller's role
  // on it; until the reminder has loaded there is no vehicle to ask about.
  const vehicleQuery = useVehicle(reminderQuery.data?.vehicleId ?? '');
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);
  const { allowNextNavigation } = useUnsavedChangesGuard({
    when: isDirty,
    message: 'You have unsaved reminder edits. Leave without saving?',
  });
  const initialValues = useMemo(
    () =>
      reminderQuery.data
        ? {
            title: reminderQuery.data.title,
            type: reminderQuery.data.type,
            dueDate: toDateInputValue(reminderQuery.data.dueDate),
            dueOdometer: reminderQuery.data.dueOdometer,
            notes: reminderQuery.data.notes ?? '',
            repeat: toRepeatChoice(reminderQuery.data),
            repeatEveryMonths: reminderQuery.data.repeatEveryMonths,
            repeatEveryKm: reminderQuery.data.repeatEveryKm,
          }
        : undefined,
    [reminderQuery.data],
  );

  async function handleUpdateReminder(
    values: Parameters<typeof updateReminderMutation.mutateAsync>[0],
  ) {
    try {
      const reminder = await updateReminderMutation.mutateAsync(values);
      const restoreNavigationGuard = allowNextNavigation();
      appToast.success({
        title: 'Reminder updated',
        description: 'Reminder changes were saved.',
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
        title: 'Unable to update reminder',
        description: getApiErrorMessage(error, 'Unable to update the reminder.'),
      });
      throw error;
    }
  }

  if (reminderQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle description="Loading this reminder before you edit it." title="Edit reminder" />
        <LoadingState description="Getting the latest reminder details." title="Loading reminder" />
      </PageContainer>
    );
  }

  if (reminderQuery.isError) {
    const isNotFound =
      reminderQuery.error instanceof ApiError && reminderQuery.error.status === 404;

    return (
      <PageContainer>
        <PageTitle
          description="You can only edit a reminder that still exists."
          title={isNotFound ? 'Reminder not found' : 'Unable to load reminder'}
        />
        <ErrorState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/upcoming">
              Back to Upcoming
            </Link>
          }
          description={
            isNotFound
              ? 'The requested reminder could not be found, so it cannot be edited.'
              : "We couldn't load this reminder. Try again in a moment."
          }
          title={isNotFound ? 'Reminder not found' : 'Unable to load reminder'}
        />
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
              params={{ reminderId }}
              to="/reminders/$reminderId"
            >
              Back to reminder
            </Link>
          }
          description="This vehicle is shared with you for reading."
          title="Edit reminder"
        />
        <ViewOnlyNotice description="You can read this reminder, but not change when it is due or what it says." />
      </PageContainer>
    );
  }

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <PageContainer className="max-w-3xl">
        <PageTitle description="Change what it says, or when it is due." title="Edit reminder" />

        <div>
          <ReminderForm
            cancel={
              <Link
                className={buttonVariants({ variant: 'ghost', size: 'lg' })}
                params={{ reminderId }}
                to="/reminders/$reminderId"
              >
                Cancel
              </Link>
            }
            followsPaper={
              reminderQuery.data.renewsDocument
                ? {
                    kind: reminderQuery.data.renewsDocument.kind,
                    title: documentKindTitles[reminderQuery.data.renewsDocument.kind],
                  }
                : undefined
            }
            initialValues={initialValues}
            isSubmitting={updateReminderMutation.isPending}
            onDirtyChange={setIsDirty}
            onSubmit={handleUpdateReminder}
            submitError={
              updateReminderMutation.error
                ? getApiErrorMessage(updateReminderMutation.error, 'Unable to update the reminder.')
                : null
            }
            submitLabel="Save changes"
            submittingLabel="Saving changes..."
            successMessage="Reminder updated."
          />
        </div>
      </PageContainer>
    </VehicleAccessProvider>
  );
}
