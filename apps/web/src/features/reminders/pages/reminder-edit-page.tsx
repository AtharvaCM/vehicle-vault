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
        <PageTitle description="Loading this reminder before you edit it." title="Edit Reminder" />
        <LoadingState
          description="Getting the latest reminder details."
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
          description="You can only edit a reminder that still exists."
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
              : "We couldn't load this reminder. Try again in a moment."
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
        description="Update timing, kilometre targets, or notes for this reminder."
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
          submitHint="Use edits when the title, due date, or due kilometre changes."
          submitLabel="Save Changes"
          submittingLabel="Saving changes..."
          successMessage="Reminder updated."
        />

        <Card>
          <CardHeader>
            <CardTitle>Keep reminders actionable</CardTitle>
            <CardDescription>Clear reminder details are easier to trust later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>Use edits when a reminder&apos;s title, timing, or kilometre target was logged incorrectly.</p>
            <p>Completed reminders can still be cleaned up if their reference details need correction.</p>
            <p>Keep notes clear so the reminder still makes sense when it resurfaces later.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
