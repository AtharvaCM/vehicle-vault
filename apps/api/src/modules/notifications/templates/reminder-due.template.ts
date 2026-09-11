import { Injectable } from '@nestjs/common';

import { prefixedTitle } from './notification-title';
import { formatDayCount, formatDueDate } from './reminder-copy';
import type { AlertTemplate, ReminderDuePayload, RenderedNotification } from '../types';

const TITLE_PREFIX = 'Reminder Due Soon: ';

@Injectable()
export class ReminderDueTemplate implements AlertTemplate<'reminder-due'> {
  readonly kind = 'reminder-due' as const;

  /**
   * Identity is the reminder, not the basis it was judged on. A reminder
   * carrying both a date and an odometer is one task, and the two bases must
   * not be able to leave two unread "this is due" rows behind.
   */
  dedupKey(payload: ReminderDuePayload): string {
    return `reminder-due:${payload.reminderId}`;
  }

  render(payload: ReminderDuePayload): RenderedNotification {
    return {
      title: prefixedTitle(TITLE_PREFIX, payload.title),
      message: this.message(payload),
      type: 'warning',
      link: `/vehicles/${payload.vehicleId}?tab=reminders`,
    };
  }

  private message(payload: ReminderDuePayload): string {
    if (payload.basis === 'date') {
      const dueDate = formatDueDate(payload.dueDate);

      return payload.daysUntilDue === 0
        ? `"${payload.title}" is due today, ${dueDate}.`
        : `"${payload.title}" is due in ${formatDayCount(payload.daysUntilDue)} on ${dueDate}.`;
    }

    const remainingKm = Math.round(payload.remainingDistanceKm);

    return `Your vehicle is approaching ${payload.dueOdometer}km (approx. ${remainingKm}km left) for "${payload.title}".`;
  }
}
