import { Link, useNavigate } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { ResourceLoadError } from '@/components/errors/resource-load-error';
import { buttonVariants } from '@/components/ui/button';
import { documentKindTitles } from '@/features/vehicle-documents/utils/document-kind-labels';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';

import { useDeleteReminder } from '../hooks/use-delete-reminder';
import { useReminder } from '../hooks/use-reminder';
import { ReminderActions } from '../components/reminder-actions';
import { ReminderSummaryCard } from '../components/reminder-summary-card';
import { describeWhatDoneDoes } from '../utils/what-done-does';

type ReminderDetailPageProps = {
  reminderId: string;
};

export function ReminderDetailPage({ reminderId }: ReminderDetailPageProps) {
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const reminderQuery = useReminder(reminderId);
  // The reminder names its vehicle, and the vehicle carries both the label for
  // it and the caller's role on it; until the reminder has loaded there is no
  // vehicle to ask about.
  const vehicleQuery = useVehicle(reminderQuery.data?.vehicleId ?? '');
  const currentUserRole = vehicleQuery.data?.currentUserRole ?? null;
  const { canEdit } = accessFor(currentUserRole);
  const deleteReminderMutation = useDeleteReminder();

  async function handleDeleteReminder(vehicleId: string) {
    try {
      setActionError(null);
      await deleteReminderMutation.mutateAsync(reminderId);
      appToast.success({
        title: 'Reminder deleted',
        description: 'This reminder was removed.',
      });
      await navigate({
        to: '/vehicles/$vehicleId',
        params: {
          vehicleId,
        },
        search: { tab: 'reminders' },
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
    return (
      <ResourceLoadError
        error={reminderQuery.error}
        isRetrying={reminderQuery.isRefetching}
        listAction={
          <Link className={buttonVariants({ variant: 'secondary' })} to="/upcoming">
            Upcoming
          </Link>
        }
        onRetry={() => void reminderQuery.refetch()}
        pageDescription="Review when this item is due and what it is for."
        resourceLabel="Reminder"
        subject="reminder"
      />
    );
  }

  const reminder = reminderQuery.data;
  const linkedVehicle = vehicleQuery.data;
  const whatDoneDoes = describeWhatDoneDoes(reminder);
  const showActions = canEdit && reminder.status !== ReminderStatus.Completed;
  const nextStep = reminder.renewsDocument ? (
    <p className="text-ui text-fg-2" data-testid="reminder-follows-paper">
      Follows the {documentKindTitles[reminder.renewsDocument.kind].toLowerCase()}: due when it
      ends, and renewing it closes this reminder and starts the next.{' '}
      <Link
        className="font-semibold text-brand hover:underline"
        params={{ vehicleId: reminder.vehicleId }}
        search={{ tab: 'papers' }}
        to="/vehicles/$vehicleId"
      >
        See papers
      </Link>
    </p>
  ) : whatDoneDoes && !reminder.completedAt ? (
    <p className="text-ui text-fg-2" data-testid="reminder-next-step">
      {whatDoneDoes}
    </p>
  ) : null;
  const vehicleLabel = linkedVehicle
    ? `${linkedVehicle.nickname?.trim() || `${linkedVehicle.make} ${linkedVehicle.model}`} • ${linkedVehicle.registrationNumber}`
    : 'Vehicle details unavailable';

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <PageContainer>
        <PageTitle
          actions={
            <>
              <Link
                className={buttonVariants({ variant: 'secondary' })}
                params={{ vehicleId: reminder.vehicleId }}
                search={{ tab: 'reminders' }}
                to="/vehicles/$vehicleId"
              >
                Back to Reminders
              </Link>
              {canEdit ? (
                <>
                  <Link
                    className={buttonVariants({ variant: 'secondary' })}
                    params={{ reminderId: reminder.id }}
                    to="/reminders/$reminderId/edit"
                  >
                    Edit reminder
                  </Link>
                  <ConfirmActionDialog
                    confirmLabel="Delete reminder"
                    description="This removes the reminder from this vehicle. This can't be undone."
                    isPending={deleteReminderMutation.isPending}
                    onConfirm={() => handleDeleteReminder(reminder.vehicleId)}
                    title="Delete this reminder?"
                    triggerLabel="Delete reminder"
                    triggerVariant="secondary"
                  />
                </>
              ) : null}
            </>
          }
          description="Review when this item is due and what it is for."
          title={reminder.title}
        />

        {actionError ? <InlineError message={actionError} /> : null}

        {/* What happens next, beside the verbs that make it happen. */}
        {nextStep || showActions ? (
          <section
            aria-label="What happens next"
            className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            {nextStep}
            {showActions ? (
              <ReminderActions
                className="shrink-0 max-sm:[&>*]:flex-1"
                currentOdometer={linkedVehicle?.odometer}
                primary
                reminder={reminder}
                size="default"
              />
            ) : null}
          </section>
        ) : null}

        <ReminderSummaryCard reminder={reminder} vehicleLabel={vehicleLabel} />
      </PageContainer>
    </VehicleAccessProvider>
  );
}
