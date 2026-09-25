import {
  reminderSnoozeEarliestDay,
  reminderSnoozeTarget,
  type ReminderSnoozeInput,
  type ReminderSnoozeTarget,
} from '@vehicle-vault/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import { useSnoozeReminder } from '../hooks/use-snooze-reminder';
import type { Reminder } from '../types/reminder';

/** The fields a snooze reads: a reminder, or a Home / Upcoming reminder row. */
export type SnoozeSubject = {
  id: string;
  title: string;
  dueDate?: string | null;
  dueOdometer?: number | null;
};

type SnoozeChoice = 'week' | 'month' | 'date';

const CHOICE_LABELS: Record<SnoozeChoice, string> = {
  week: '1 week',
  month: '1 month',
  date: 'Pick a date',
};

/** A calendar day as the API takes it (`YYYY-MM-DD`), read in the owner's own time zone. */
function toDay(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/** A UTC day (how the API dates reminders) as the same calendar day in local time, for the picker. */
function toLocalDay(utc: Date): Date {
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** "Due again 2 Oct 2026 or at 45,500 km": where the reminder lands, before anyone commits to it. */
export function describeSnoozeTarget(target: ReminderSnoozeTarget): string {
  const date = target.dueDate ? format.date(target.dueDate) : null;
  const odometer = target.dueOdometer !== null ? format.odometer(target.dueOdometer) : null;

  if (date && odometer) return `Due again ${date} or at ${odometer}, whichever comes first`;
  if (date) return `Due again ${date}`;
  if (odometer) return `Due again at ${odometer}`;
  return '';
}

type SnoozeReminderDialogProps = {
  /** The reminder to snooze; null keeps the dialog closed. */
  reminder: SnoozeSubject | null;
  /** The vehicle's odometer, so the preview moves kilometres from where the API will. */
  currentOdometer?: number;
  onOpenChange: (open: boolean) => void;
  onSnoozed?: (reminder: Reminder) => void;
};

/**
 * The one Snooze: a week, a month, or until a day the owner picks, with the
 * new due date (and kilometres) shown before it is saved. Home, Upcoming, a
 * vehicle's Reminders tab and the reminder page all open this, so the choices
 * and wording match everywhere. The preview runs the API's own rule
 * (`reminderSnoozeTarget`), so it cannot promise a date the API will not write.
 */
export function SnoozeReminderDialog({
  reminder,
  currentOdometer,
  onOpenChange,
  onSnoozed,
}: SnoozeReminderDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={reminder !== null}>
      {reminder ? (
        <SnoozeReminderContent
          currentOdometer={currentOdometer}
          key={reminder.id}
          onDone={() => onOpenChange(false)}
          onSnoozed={onSnoozed}
          reminder={reminder}
        />
      ) : null}
    </Dialog>
  );
}

type SnoozeReminderContentProps = {
  reminder: SnoozeSubject;
  currentOdometer?: number;
  onDone: () => void;
  onSnoozed?: (reminder: Reminder) => void;
};

function SnoozeReminderContent({
  reminder,
  currentOdometer,
  onDone,
  onSnoozed,
}: SnoozeReminderContentProps) {
  const snoozeReminder = useSnoozeReminder();
  const [choice, setChoice] = useState<SnoozeChoice>('week');
  const [day, setDay] = useState<Date | undefined>(undefined);
  const now = new Date();
  const earliest = toLocalDay(reminderSnoozeEarliestDay(reminder, now));

  const input: ReminderSnoozeInput | null =
    choice === 'date' ? (day ? { until: toDay(day) } : null) : { period: choice };
  const target = input
    ? reminderSnoozeTarget(reminder, currentOdometer ?? reminder.dueOdometer ?? 0, input, now)
    : null;

  function handleSnooze() {
    if (!input || !target) return;
    snoozeReminder.mutate(
      { reminderId: reminder.id, choice: input },
      {
        onSuccess: (updated) => {
          appToast.success({
            title: 'Snoozed',
            description: `${reminder.title} · ${describeSnoozeTarget(target)}`,
          });
          onSnoozed?.(updated);
          onDone();
        },
        onError: (error) => {
          appToast.error({ title: 'Unable to snooze', description: getApiErrorMessage(error) });
        },
      },
    );
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Snooze {reminder.title}</DialogTitle>
        <DialogDescription>Move it later, and hear about it again then.</DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <ToggleGroup
          aria-label="How long"
          className="flex w-full"
          onValueChange={(value) => {
            if (value) setChoice(value as SnoozeChoice);
          }}
          type="single"
          value={choice}
        >
          {(Object.keys(CHOICE_LABELS) as SnoozeChoice[]).map((value) => (
            <ToggleGroupItem className="flex-1" key={value} value={value}>
              {CHOICE_LABELS[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {choice === 'date' ? (
          <DatePicker
            aria-invalid={day !== undefined && target === null}
            fromDate={earliest}
            onChange={setDay}
            placeholder="Pick the day"
            value={day}
          />
        ) : null}

        <p aria-live="polite" className="text-ui text-fg-2" data-testid="snooze-preview">
          {target ? describeSnoozeTarget(target) : 'Pick the day it should come back.'}
        </p>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={!target || snoozeReminder.isPending} onClick={handleSnooze} type="button">
          {snoozeReminder.isPending ? 'Snoozing…' : 'Snooze'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
