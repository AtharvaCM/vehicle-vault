import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { Reminder } from '../types/reminder';
import { ReminderCard } from './reminder-card';

type ReminderListProps = {
  description?: string;
  emptyMessage: string;
  reminders: Reminder[];
  title: string;
  vehicleLabelById?: Record<string, string>;
};

export function ReminderList({
  description,
  emptyMessage,
  reminders,
  title,
  vehicleLabelById,
}: ReminderListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {reminders.length ? (
          reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              vehicleLabel={vehicleLabelById?.[reminder.vehicleId]}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            {emptyMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
