import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { Reminder } from '../types/reminder';
import { ReminderCard } from './reminder-card';

type ReminderListProps = {
  description?: string;
  emptyMessage: string;
  onSelectionChange?: (reminderId: string, checked: boolean) => void;
  selectedReminderIds?: string[];
  reminders: Reminder[];
  title: string;
  vehicleLabelById?: Record<string, string>;
};

export function ReminderList({
  description,
  emptyMessage,
  onSelectionChange,
  selectedReminderIds = [],
  reminders,
  title,
  vehicleLabelById,
}: ReminderListProps) {
  return (
    <Card className="p-3 sm:p-5">
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-2.5">
        {reminders.length ? (
          reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              selectionControl={
                onSelectionChange ? (
                  <label className="flex items-center justify-center rounded-md border border-border/70 bg-surface p-2 shadow-xs">
                    <input
                      aria-label={`Select reminder ${reminder.title}`}
                      checked={selectedReminderIds.includes(reminder.id)}
                      className={cn('h-4 w-4 rounded border-line text-fg focus:ring-line')}
                      onChange={(event) =>
                        onSelectionChange(reminder.id, event.currentTarget.checked)
                      }
                      type="checkbox"
                    />
                  </label>
                ) : null
              }
              vehicleLabel={vehicleLabelById?.[reminder.vehicleId]}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-line px-4 py-5 text-ui text-fg-3">
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
