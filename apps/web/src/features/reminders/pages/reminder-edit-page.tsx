import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { toDateInputValue } from '@/lib/utils/to-date-input-value';

import { ReminderForm } from '../components/reminder-form';
import { useReminder } from '../hooks/use-reminder';
import { useUpdateReminder } from '../hooks/use-update-reminder';

type ReminderEditPageProps = {
  reminderId: string;
};

export function ReminderEditPage({ reminderId }: ReminderEditPageProps) {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const reminderQuery = useReminder(reminderId);
  const updateReminderMutation = useUpdateReminder(reminderId);
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
        description: 'Reminder changes were saved successfully.',
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
        <PageTitle description="Loading the reminder before editing." title="Edit Reminder" />
        <LoadingState
          description="Fetching the current reminder values from the API."
          title="Loading reminder"
        />
      </PageContainer>
    );
  }

  if (reminderQuery.isError) {
    const isNotFound =
      reminderQuery.error instanceof ApiError && reminderQuery.error.status === 404;

    return (
      <PageContainer>
        <PageTitle
          description="Reminder edits require an existing reminder record."
          title={isNotFound ? 'Reminder not found' : 'Unable to load reminder'}
        />
        <ErrorState
          action={
            <Link className={buttonVariants({ variant: 'secondary' })} to="/reminders">
              Back to Reminders
            </Link>
          }
          description={
            isNotFound
              ? 'The requested reminder could not be found, so it cannot be edited.'
              : 'The reminder could not be loaded. Check the API and try again.'
          }
          title={isNotFound ? 'Reminder not found' : 'Unable to load reminder'}
        />
      </PageContainer>
    );
  }
  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link
            className={buttonVariants({ variant: 'secondary' })}
            params={{ reminderId }}
            to="/reminders/$reminderId"
          >
            Back to Reminder
          </Link>
        }
        description="Update the reminder details while preserving ownership and status behavior."
        title="Edit Reminder"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ReminderForm
          initialValues={initialValues}
          isSubmitting={updateReminderMutation.isPending}
          onDirtyChange={setIsDirty}
          onSubmit={handleUpdateReminder}
          submitError={
            updateReminderMutation.error
              ? getApiErrorMessage(updateReminderMutation.error, 'Unable to update the reminder.')
              : null
          }
          submitHint="Reminder edits update status calculations the next time reminder data is queried."
          submitLabel="Save Changes"
          submittingLabel="Saving changes..."
          successMessage="Reminder updated successfully."
        />

        <Card>
          <CardHeader>
            <CardTitle>Edit guidance</CardTitle>
            <CardDescription>Keep due dates and due odometer thresholds trustworthy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Use edits when a reminder’s title, timing, or threshold was logged incorrectly.</p>
            <p>Completed reminders can still be edited if their reference details need cleanup.</p>
            <p>Reminder visibility across the dashboard and vehicle pages updates after save.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
