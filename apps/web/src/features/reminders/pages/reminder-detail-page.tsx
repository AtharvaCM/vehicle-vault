import { Link, useNavigate } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';

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
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  }

  async function handleDeleteReminder(vehicleId: string) {
    try {
      setActionError(null);
      await deleteReminderMutation.mutateAsync(reminderId);
      await navigate({
        to: '/vehicles/$vehicleId/reminders',
        params: {
          vehicleId,
        },
      });
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  }

  if (reminderQuery.isPending) {
    return (
      <PageContainer>
        <PageTitle description="Loading the latest reminder from the API." title="Reminder" />
        <Card>
          <CardHeader>
            <CardTitle>Loading reminder</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Please wait while the reminder is fetched.
          </CardContent>
        </Card>
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
        <EmptyState
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
            {reminder.status !== ReminderStatus.Completed ? (
              <Button
                disabled={completeReminderMutation.isPending}
                onClick={handleCompleteReminder}
                type="button"
              >
                {completeReminderMutation.isPending ? 'Completing...' : 'Mark Complete'}
              </Button>
            ) : null}
            <Button
              disabled={deleteReminderMutation.isPending}
              onClick={() => handleDeleteReminder(reminder.vehicleId)}
              type="button"
              variant="secondary"
            >
              {deleteReminderMutation.isPending ? 'Deleting...' : 'Delete Reminder'}
            </Button>
          </div>
        }
        description="Review and manage a single reminder record."
        title={reminder.title}
      />

      {actionError ? (
        <p className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </p>
      ) : null}

      <ReminderSummaryCard reminder={reminder} />
    </PageContainer>
  );
}

function getApiErrorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    error.data &&
    typeof error.data === 'object' &&
    'error' in error.data &&
    error.data.error &&
    typeof error.data.error === 'object' &&
    'message' in error.data.error &&
    typeof error.data.error.message === 'string'
  ) {
    return error.data.error.message;
  }

  return error instanceof Error ? error.message : 'The reminder action failed.';
}
