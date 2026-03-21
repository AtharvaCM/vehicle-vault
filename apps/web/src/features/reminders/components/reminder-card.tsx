import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { ReminderStatus } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format-date';

import type { Reminder } from '../types/reminder';
import { formatReminderType } from '../utils/format-reminder-type';
import { ReminderStatusBadge } from './reminder-status-badge';

type ReminderCardProps = {
  reminder: Reminder;
  selectionControl?: ReactNode;
  vehicleLabel?: string;
};

export function ReminderCard({ reminder, selectionControl, vehicleLabel }: ReminderCardProps) {
  const urgencyStyles =
    reminder.status === ReminderStatus.Overdue
      ? 'border-rose-200 bg-rose-50/40'
      : reminder.status === ReminderStatus.DueToday
        ? 'border-amber-200 bg-amber-50/40'
        : reminder.status === ReminderStatus.Completed
          ? 'border-slate-200 bg-slate-50/70'
          : 'border-slate-200 bg-white';

  return (
    <div className="flex items-start gap-3">
      {selectionControl ? <div className="pt-3">{selectionControl}</div> : null}
      <Link className="flex-1" params={{ reminderId: reminder.id }} to="/reminders/$reminderId">
        <Card className={cn('rounded-xl transition-colors hover:border-slate-300', urgencyStyles)}>
          <CardContent className="grid gap-3.5 p-3.5 md:grid-cols-[1.4fr_0.9fr_auto] md:items-center">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-950">{reminder.title}</p>
                <Badge>{formatReminderType(reminder.type)}</Badge>
              </div>
              <div className="space-y-0.5 text-[13px] text-slate-600">
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

            <div className="flex items-center justify-end gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Open
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
