import { Injectable } from '@nestjs/common';

import { prefixedTitle } from './notification-title';
import type { AlertTemplate, ReminderOverduePayload, RenderedNotification } from '../types';

const TITLE_PREFIX = 'Overdue Reminder: ';

@Injectable()
export class ReminderOverdueTemplate implements AlertTemplate<'reminder-overdue'> {
  readonly kind = 'reminder-overdue' as const;

  dedupKey(payload: ReminderOverduePayload): string {
    return `reminder-overdue:${payload.reminderId}`;
  }

  render(payload: ReminderOverduePayload): RenderedNotification {
    return {
      title: prefixedTitle(TITLE_PREFIX, payload.title),
      message: `Your vehicle has passed the ${payload.dueOdometer}km mark set for "${payload.title}". Please attend to this task.`,
      type: 'error',
      link: `/vehicles/${payload.vehicleId}?tab=reminders`,
    };
  }
}
