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
import { useVehicles } from '@/features/vehicles/hooks/use-vehicles';

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
  const vehiclesQuery = useVehicles();
  const completeReminderMutation = useCompleteReminder();
  const deleteReminderMutation = useDeleteReminder();

  async function handleCompleteReminder() {
    try {
      setActionError(null);
      await completeReminderMutation.mutateAsync(reminderId);
      appToast.success({
        title: 'Reminder completed',
        description: 'This reminder is now marked complete.',
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
        description: 'This reminder was removed.',
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
        <PageTitle description="Loading this reminder." title="Reminder" />
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
          description="Review when this item is due and what it is for."
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
              : "We couldn't load this reminder. Try again in a moment."
          }
          title={isNotFound ? 'Reminder not found' : 'Reminder request failed'}
        />
      </PageContainer>
    );
  }

  const reminder = reminderQuery.data;
  const linkedVehicle = (vehiclesQuery.data ?? []).find(
    (vehicle) => vehicle.id === reminder.vehicleId,
  );
  const vehicleLabel = linkedVehicle
    ? `${linkedVehicle.nickname?.trim() || `${linkedVehicle.make} ${linkedVehicle.model}`} • ${linkedVehicle.registrationNumber}`
    : 'Vehicle details unavailable';

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
              description="This removes the reminder from this vehicle. This can't be undone."
              isPending={deleteReminderMutation.isPending}
              onConfirm={() => handleDeleteReminder(reminder.vehicleId)}
              title="Delete this reminder?"
              triggerLabel="Delete Reminder"
              triggerVariant="secondary"
            />
          </div>
        }
        description="Review when this item is due and what it is for."
        title={reminder.title}
      />

      {actionError ? <InlineError message={actionError} /> : null}

      <ReminderSummaryCard reminder={reminder} vehicleLabel={vehicleLabel} />
    </PageContainer>
  );
}
