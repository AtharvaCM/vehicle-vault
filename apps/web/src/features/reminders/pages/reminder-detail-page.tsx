import { Link, useNavigate } from '@tanstack/react-router';
import { ReminderStatus } from '@vehicle-vault/shared';
import { BellOff, Check, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { confirm } from '@/components/shared/confirm';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { StatusDot } from '@/components/shared/status-pill';
import { ResourceLoadError } from '@/components/errors/resource-load-error';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { documentKindTitles } from '@/features/vehicle-documents/utils/document-kind-labels';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';
import { accessFor, VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';
import { getVehicleDisplayName } from '@/features/vehicles/utils/get-vehicle-display-name';

import { SnoozeReminderDialog } from '../components/snooze-reminder-dialog';
import { useCompleteReminder } from '../hooks/use-complete-reminder';
import { useDeleteReminder } from '../hooks/use-delete-reminder';
import { useReminder } from '../hooks/use-reminder';
import type { Reminder } from '../types/reminder';
import { describeDue } from '../utils/describe-due';
import { logServiceSearchFor, reminderDoneAction } from '../utils/reminder-done';
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
          <Link className={buttonVariants({ variant: 'outline' })} to="/upcoming">
            Upcoming
          </Link>
        }
        onRetry={() => void reminderQuery.refetch()}
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
    ? `${getVehicleDisplayName(linkedVehicle)} · ${format.registration(linkedVehicle.registrationNumber)}`
    : undefined;
  const due = describeDue(reminder, { odometer: linkedVehicle?.odometer });

  async function askToDelete() {
    const confirmed = await confirm({
      title: 'Delete this reminder?',
      description: "This removes the reminder from this vehicle. This can't be undone.",
      confirmLabel: 'Delete reminder',
      destructive: true,
    });
    if (confirmed) await handleDeleteReminder(reminder.vehicleId);
  }

  return (
    <VehicleAccessProvider role={currentUserRole}>
      <PageContainer>
        <PageTitle
          actions={
            canEdit ? (
              // Its own size, even where the header stacks its actions full width.
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label="More reminder actions"
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link params={{ reminderId: reminder.id }} to="/reminders/$reminderId/edit">
                        Edit reminder
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-late"
                      disabled={deleteReminderMutation.isPending}
                      onSelect={() => void askToDelete()}
                    >
                      Delete reminder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : undefined
          }
          description={[vehicleLabel, format.enumLabel('reminderType', reminder.type)]
            .filter(Boolean)
            .join(' · ')}
          title={reminder.title}
        />

        {actionError ? <InlineError message={actionError} /> : null}

        {/* The one decision: where it stands, and the verb that settles it. */}
        <section
          aria-label="Where this reminder stands"
          className="space-y-4"
          data-testid="reminder-decision"
        >
          <div className="space-y-1.5">
            <p className="text-heading font-semibold tracking-tight" data-testid="reminder-due">
              <StatusDot className="text-heading" status={due.status}>
                {due.text}
              </StatusDot>
            </p>
            {nextStep}
          </div>
          {showActions ? (
            <ReminderDecision currentOdometer={linkedVehicle?.odometer} reminder={reminder} />
          ) : null}
        </section>

        {reminder.notes?.trim() ? (
          <section aria-labelledby="reminder-notes" className="max-w-3xl space-y-1">
            <h2 className="text-small font-semibold text-fg-2" id="reminder-notes">
              Notes
            </h2>
            <p className="whitespace-pre-line text-body text-fg">{reminder.notes.trim()}</p>
          </section>
        ) : null}

        <p className="text-caption text-fg-3">
          Added {format.date(reminder.createdAt)}
          {reminder.updatedAt !== reminder.createdAt
            ? ` · last edited ${format.date(reminder.updatedAt)}`
            : null}
        </p>
      </PageContainer>
    </VehicleAccessProvider>
  );
}

/**
 * The reminder's one primary verb, by `reminderDoneAction`: Renew for a
 * renewal that follows a paper, Log service for a service (with "Mark done
 * without logging" beside it), Done otherwise; and Snooze, except on a
 * renewal, which is snoozed through its paper.
 */
function ReminderDecision({
  reminder,
  currentOdometer,
}: {
  reminder: Reminder;
  currentOdometer: number | undefined;
}) {
  const completeReminder = useCompleteReminder();
  const [snoozing, setSnoozing] = useState(false);
  const action = reminderDoneAction(reminder);

  function markDone() {
    completeReminder.mutate(reminder.id, {
      onSuccess: () =>
        appToast.success({ title: 'Reminder completed', description: reminder.title }),
      onError: (error) =>
        appToast.error({
          title: 'Unable to complete reminder',
          description: getApiErrorMessage(error, 'Unable to complete the reminder.'),
        }),
    });
  }

  if (action === 'renew') {
    return (
      <Link
        className={buttonVariants({ className: 'w-full sm:w-auto' })}
        params={{ vehicleId: reminder.vehicleId }}
        search={{ tab: 'papers' }}
        to="/vehicles/$vehicleId"
      >
        Renew
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {action === 'log' ? (
          <Link
            className={buttonVariants({ className: 'flex-1 sm:flex-none' })}
            params={{ vehicleId: reminder.vehicleId }}
            search={logServiceSearchFor(reminder)}
            to="/vehicles/$vehicleId/maintenance/new"
          >
            Log service
          </Link>
        ) : (
          <Button
            aria-label={`Mark ${reminder.title} done`}
            className="flex-1 sm:flex-none"
            disabled={completeReminder.isPending}
            onClick={markDone}
            type="button"
          >
            <Check aria-hidden="true" />
            Done
          </Button>
        )}
        <Button
          aria-label={`Snooze ${reminder.title}`}
          onClick={() => setSnoozing(true)}
          type="button"
          variant="outline"
        >
          <BellOff aria-hidden="true" />
          Snooze
        </Button>
      </div>
      {action === 'log' ? (
        <button
          className="self-start text-ui font-medium text-fg-2 underline-offset-2 hover:text-fg hover:underline disabled:opacity-50"
          disabled={completeReminder.isPending}
          onClick={markDone}
          type="button"
        >
          Mark done without logging
        </button>
      ) : null}
      <SnoozeReminderDialog
        currentOdometer={currentOdometer}
        onOpenChange={setSnoozing}
        reminder={snoozing ? reminder : null}
      />
    </div>
  );
}
