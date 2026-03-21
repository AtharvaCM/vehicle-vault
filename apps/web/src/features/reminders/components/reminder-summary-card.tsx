import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/format-date';

import type { Reminder } from '../types/reminder';
import { formatReminderType } from '../utils/format-reminder-type';
import { ReminderStatusBadge } from './reminder-status-badge';

type ReminderSummaryCardProps = {
  reminder: Reminder;
  vehicleLabel?: string;
};

export function ReminderSummaryCard({ reminder, vehicleLabel }: ReminderSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{reminder.title}</CardTitle>
          <Badge>{formatReminderType(reminder.type)}</Badge>
          <ReminderStatusBadge status={reminder.status} />
        </div>
        <CardDescription>
          Review what this reminder is for, when it is due, and which vehicle it belongs to.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Detail label="Vehicle" value={vehicleLabel ?? 'Vehicle details unavailable'} />
        <Detail
          label="Due date"
          value={reminder.dueDate ? formatDate(reminder.dueDate) : 'Not specified'}
        />
        <Detail
          label="Due odometer"
          value={
            reminder.dueOdometer !== undefined
              ? `${reminder.dueOdometer.toLocaleString('en-IN')} km`
              : 'Not specified'
          }
        />
        <Detail
          label="Completed at"
          value={
            reminder.completedAt
              ? formatDate(reminder.completedAt, { dateStyle: 'medium', timeStyle: 'short' })
              : 'Not completed'
          }
        />
        <Detail
          className="md:col-span-2"
          label="Notes"
          value={reminder.notes?.trim() || 'No additional notes were recorded.'}
        />
        <Detail
          label="Added"
          value={formatDate(reminder.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
        />
        <Detail
          label="Last updated"
          value={formatDate(reminder.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
        />
      </CardContent>
    </Card>
  );
}

type DetailProps = {
  className?: string;
  label: string;
  value: ReactNode;
};

function Detail({ className, label, value }: DetailProps) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm text-slate-900">{value}</div>
    </div>
  );
}
