import { Link } from '@tanstack/react-router';
import { BellOff, Check } from 'lucide-react';
import { ReminderStatus } from '@vehicle-vault/shared';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { useCompleteReminder } from '../hooks/use-complete-reminder';
import type { Reminder } from '../types/reminder';
import { reminderDoneAction } from '../utils/reminder-done';
import { ReminderDoneDialog } from './reminder-done-dialog';
import { SnoozeReminderDialog } from './snooze-reminder-dialog';

type ReminderActionsProps = {
  reminder: Reminder;
  /** The vehicle's odometer, for the snooze preview. */
  currentOdometer?: number;
  /** `sm` in a card's strip; the page header's own size beside its other actions. */
  size?: 'sm' | 'default';
  /** Draws Done (or Renew) as the page's primary action. */
  primary?: boolean;
  className?: string;
};

/**
 * Done and Snooze for one open reminder, where a reminder is shown on its
 * own: a card on the vehicle's Reminders tab and the reminder page. Done
 * follows `reminderDoneAction` (Renew for a renewal that follows a paper, the
 * log-or-tick question for a service, a plain tick otherwise); Snooze opens
 * the shared dialog. A renewal is snoozed through its paper, so it has none.
 * Callers render this only for someone who can edit the vehicle.
 */
export function ReminderActions({
  reminder,
  currentOdometer,
  size = 'sm',
  primary = false,
  className,
}: ReminderActionsProps) {
  const completeReminder = useCompleteReminder();
  const [asking, setAsking] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  if (reminder.status === ReminderStatus.Completed) return null;

  const action = reminderDoneAction(reminder);

  function markDone() {
    completeReminder.mutate(reminder.id, {
      onSuccess: () => {
        appToast.success({ title: 'Reminder completed', description: reminder.title });
      },
      onError: (error) => {
        appToast.error({
          title: 'Unable to complete reminder',
          description: getApiErrorMessage(error, 'Unable to complete the reminder.'),
        });
      },
    });
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {action === 'renew' ? (
        <Link
          className={buttonVariants({ size, variant: primary ? 'default' : 'outline' })}
          params={{ vehicleId: reminder.vehicleId }}
          search={{ tab: 'papers' }}
          to="/vehicles/$vehicleId"
        >
          Renew
        </Link>
      ) : (
        <>
          <Button
            aria-label={`Snooze ${reminder.title}`}
            onClick={() => setSnoozing(true)}
            size={size}
            type="button"
            variant="ghost"
          >
            <BellOff aria-hidden="true" />
            Snooze
          </Button>
          <Button
            aria-label={`Mark ${reminder.title} done`}
            disabled={completeReminder.isPending}
            onClick={() => (action === 'log' ? setAsking(true) : markDone())}
            size={size}
            type="button"
            variant={primary ? 'default' : 'outline'}
          >
            <Check aria-hidden="true" />
            Done
          </Button>
        </>
      )}

      <ReminderDoneDialog
        isPending={completeReminder.isPending}
        onMarkDone={markDone}
        onOpenChange={setAsking}
        reminder={asking ? reminder : null}
      />
      <SnoozeReminderDialog
        currentOdometer={currentOdometer}
        onOpenChange={setSnoozing}
        reminder={snoozing ? reminder : null}
      />
    </div>
  );
}
