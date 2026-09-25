import { Link } from '@tanstack/react-router';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { logServiceSearchFor, type DoneSubject } from '../utils/reminder-done';

type ReminderDoneDialogProps = {
  /** The service reminder whose Done was pressed; null keeps the dialog closed. */
  reminder: (DoneSubject & { title: string }) | null;
  onOpenChange: (open: boolean) => void;
  /** "Mark done without logging": completes the reminder as Done always did. */
  onMarkDone: () => void;
  isPending?: boolean;
};

/**
 * Done on a service reminder: log the service now, or mark it done without
 * logging. Logging opens the log-service form with the category preselected
 * and the reminder named (`?category=&reminderId=`); saving that record
 * completes the reminder, and its next occurrence is counted from the record.
 * Ticking it off leaves no record, so the next one is counted from today.
 */
export function ReminderDoneDialog({
  reminder,
  onOpenChange,
  onMarkDone,
  isPending = false,
}: ReminderDoneDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={reminder !== null}>
      {reminder ? (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Done with {reminder.title}?</DialogTitle>
            <DialogDescription>
              Log the service to keep the bill and the reading. The next reminder is counted from
              it.
            </DialogDescription>
          </DialogHeader>
          {/* Stacked at every width, the log link on top: it is the answer we hope for. */}
          <DialogFooter className="sm:flex-col-reverse sm:items-stretch sm:justify-start">
            <Button
              disabled={isPending}
              onClick={() => {
                onMarkDone();
                onOpenChange(false);
              }}
              type="button"
              variant="outline"
            >
              Mark done without logging
            </Button>
            <Link
              className={buttonVariants({ size: 'lg' })}
              onClick={() => onOpenChange(false)}
              params={{ vehicleId: reminder.vehicleId }}
              search={logServiceSearchFor(reminder)}
              to="/vehicles/$vehicleId/maintenance/new"
            >
              Log the service now
            </Link>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
