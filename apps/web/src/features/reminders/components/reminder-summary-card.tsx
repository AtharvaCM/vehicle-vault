import { Figure } from '@/components/shared/figure';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';

import type { Reminder } from '../types/reminder';
import { describeRepeatRule } from '../utils/repeat-rule';
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
          <Badge>{format.enumLabel('reminderType', reminder.type)}</Badge>
          <ReminderStatusBadge status={reminder.status} />
        </div>
        <CardDescription>
          Review what this reminder is for, when it is due, and which vehicle it belongs to.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Figure label="Vehicle" value={vehicleLabel ?? 'Vehicle details unavailable'} />
        <Figure
          label="Due date"
          value={reminder.dueDate ? format.date(reminder.dueDate) : 'Not specified'}
        />
        <Figure
          label="Due odometer"
          value={
            reminder.dueOdometer !== undefined
              ? format.odometer(reminder.dueOdometer)
              : 'Not specified'
          }
        />
        <Figure label="Repeats" value={describeRepeatRule(reminder)} />
        <Figure
          label="Completed at"
          value={
            reminder.completedAt ? format.date(reminder.completedAt, 'dateTime') : 'Not completed'
          }
        />
        <Figure
          className="md:col-span-2"
          label="Notes"
          value={reminder.notes?.trim() || 'No additional notes were recorded.'}
        />
        <Figure label="Added" value={format.date(reminder.createdAt, 'dateTime')} />
        <Figure label="Last updated" value={format.date(reminder.updatedAt, 'dateTime')} />
      </CardContent>
    </Card>
  );
}
