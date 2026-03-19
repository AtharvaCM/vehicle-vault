import { Link } from '@tanstack/react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/format-date';

import type { Reminder } from '../types/reminder';
import { formatReminderType } from '../utils/format-reminder-type';
import { ReminderStatusBadge } from './reminder-status-badge';

type ReminderCardProps = {
  reminder: Reminder;
  vehicleLabel?: string;
};

export function ReminderCard({ reminder, vehicleLabel }: ReminderCardProps) {
  return (
    <Link params={{ reminderId: reminder.id }} to="/reminders/$reminderId">
      <Card className="transition-colors hover:border-slate-300">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-950">{reminder.title}</p>
              <Badge>{formatReminderType(reminder.type)}</Badge>
            </div>
            <div className="space-y-1 text-sm text-slate-600">
              {vehicleLabel ? <p>{vehicleLabel}</p> : null}
              {reminder.dueDate ? <p>Due date: {formatDate(reminder.dueDate)}</p> : null}
              {reminder.dueOdometer !== undefined ? (
                <p>Due odometer: {reminder.dueOdometer.toLocaleString('en-IN')} km</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ReminderStatusBadge status={reminder.status} />
          </div>

          <div className="text-sm font-medium text-slate-900">View reminder</div>
        </CardContent>
      </Card>
    </Link>
  );
}
