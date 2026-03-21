import { Link, useNavigate } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { useCompleteReminder } from '../hooks/use-complete-reminder';
import { useDeleteReminder } from '../hooks/use-delete-reminder';
import { useReminder } from '../hooks/use-reminder';
import { ReminderSummaryCard } from '../components/reminder-summary-card';

type ReminderDetailPageProps = {
  reminderId: string;
};

export function ReminderDetailPage({ reminderId }: ReminderDetailPageProps) {
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const reminderQuery = useReminder(reminderId);
  const completeReminderMutation = useCompleteReminder();
  const deleteReminderMutation = useDeleteReminder();

  async function handleCompleteReminder() {
    try {
      setActionError(null);
      await completeReminderMutation.mutateAsync(reminderId);
      appToast.success({
        title: 'Reminder completed',
        description: 'The reminder status was updated successfully.',
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to complete reminder',
        description: getApiErrorMessage(error, 'Unable to complete the reminder.'),
      });
      setActionError(getApiErrorMessage(error, 'Unable to complete the reminder.'));
    }
  }

  async function handleDeleteReminder(vehicleId: string) {
    try {
      setActionError(null);
      await deleteReminderMutation.mutateAsync(reminderId);
      appToast.success({
        title: 'Reminder deleted',
        description: 'The reminder was removed successfully.',
      });
      await navigate({
        to: '/vehicles/$vehicleId/reminders',
        params: {
          vehicleId,
        },
      });
    } catch (error) {
      appToast.error({
        title: 'Unable to delete reminder',
        description: getApiErrorMessage(error, 'Unable to delete the reminder.'),
      });
      setActionError(getApiErrorMessage(error));
    }
  }

  if (reminderQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle description="Loading the latest reminder from the API." title="Reminder" />
        <LoadingState
          description="Fetching the latest reminder from the API."
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
          description="Reminder detail pages are driven by backend state."
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
              ? 'The requested reminder does not exist or may have been removed.'
              : 'The reminder could not be loaded. Check that the API is running and try again.'
          }
          title={isNotFound ? 'Reminder not found' : 'Reminder request failed'}
        />
      </PageContainer>
    );
  }

  const reminder = reminderQuery.data;

  return (
    <PageContainer>
      <PageTitle
        actions={
          <div className="flex gap-3">
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ vehicleId: reminder.vehicleId }}
              to="/vehicles/$vehicleId/reminders"
            >
              Back to Vehicle Reminders
            </Link>
            <Link
              className={buttonVariants({ variant: 'secondary' })}
              params={{ reminderId: reminder.id }}
              to="/reminders/$reminderId/edit"
            >
              Edit Reminder
            </Link>
            {reminder.status !== ReminderStatus.Completed ? (
              <Button
                disabled={completeReminderMutation.isPending}
                onClick={handleCompleteReminder}
                size="sm"
                type="button"
              >
                {completeReminderMutation.isPending ? 'Completing...' : 'Mark Complete'}
              </Button>
            ) : null}
            <ConfirmActionDialog
              confirmLabel="Delete reminder"
              description="This removes the reminder from the vehicle and dashboard views. This action cannot be undone."
              isPending={deleteReminderMutation.isPending}
              onConfirm={() => handleDeleteReminder(reminder.vehicleId)}
              title="Delete this reminder?"
              triggerLabel="Delete Reminder"
              triggerVariant="secondary"
            />
          </div>
        }
        description="Review and manage a single reminder record."
        title={reminder.title}
      />

      {actionError ? <InlineError message={actionError} /> : null}

      <ReminderSummaryCard reminder={reminder} />
    </PageContainer>
  );
}
