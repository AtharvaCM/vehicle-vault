import { Injectable } from '@nestjs/common';

import type {
  AlertTemplate,
  ReminderOverduePayload,
  RenderedNotification,
} from '../types';

@Injectable()
export class ReminderOverdueTemplate implements AlertTemplate<'reminder-overdue'> {
  readonly kind = 'reminder-overdue' as const;

  dedupKey(payload: ReminderOverduePayload): string {
    return `reminder-overdue:${payload.reminderId}`;
  }

  render(payload: ReminderOverduePayload): RenderedNotification {
    return {
      title: `Overdue Reminder: ${payload.title}`,
      message: `Your vehicle has passed the ${payload.dueOdometer}km mark set for "${payload.title}". Please attend to this task.`,
      type: 'error',
      link: `/vehicles/${payload.vehicleId}?tab=reminders`,
    };
  }
}
