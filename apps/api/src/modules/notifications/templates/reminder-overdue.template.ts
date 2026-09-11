import { Injectable } from '@nestjs/common';

import { formatDayCount, formatDueDate } from './reminder-copy';
import type { AlertTemplate, ReminderOverduePayload, RenderedNotification } from '../types';

@Injectable()
export class ReminderOverdueTemplate implements AlertTemplate<'reminder-overdue'> {
  readonly kind = 'reminder-overdue' as const;

  /** Reminder-scoped for the same reason as `reminder-due`: one task, one row. */
  dedupKey(payload: ReminderOverduePayload): string {
    return `reminder-overdue:${payload.reminderId}`;
  }

  render(payload: ReminderOverduePayload): RenderedNotification {
    return {
      title: `Overdue Reminder: ${payload.title}`,
      message: this.message(payload),
      type: 'error',
      link: `/vehicles/${payload.vehicleId}?tab=reminders`,
    };
  }

  private message(payload: ReminderOverduePayload): string {
    if (payload.basis === 'date') {
      return `"${payload.title}" was due on ${formatDueDate(payload.dueDate)}, ${formatDayCount(
        payload.daysUntilDue,
      )} ago. Please attend to this task.`;
    }

    return `Your vehicle has passed the ${payload.dueOdometer}km mark set for "${payload.title}". Please attend to this task.`;
  }
}
