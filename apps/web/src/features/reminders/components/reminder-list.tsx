import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

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
    <Card>
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
                  <label
                    className="flex items-center justify-center rounded-md border border-border/70 bg-white p-2 shadow-sm"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <input
                      aria-label={`Select reminder ${reminder.title}`}
                      checked={selectedReminderIds.includes(reminder.id)}
                      className={cn(
                        'h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400',
                      )}
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
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
