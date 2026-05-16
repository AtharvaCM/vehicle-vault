import { Injectable } from '@nestjs/common';

import type { AlertTemplate, ReminderDuePayload, RenderedNotification } from '../types';

@Injectable()
export class ReminderDueTemplate implements AlertTemplate<'reminder-due'> {
  readonly kind = 'reminder-due' as const;

  dedupKey(payload: ReminderDuePayload): string {
    return `reminder-due:${payload.reminderId}`;
  }

  render(payload: ReminderDuePayload): RenderedNotification {
    const remainingKm = Math.round(payload.remainingDistanceKm);

    return {
      title: `Reminder Due Soon: ${payload.title}`,
      message: `Your vehicle is approaching ${payload.dueOdometer}km (approx. ${remainingKm}km left) for "${payload.title}".`,
      type: 'warning',
      link: `/vehicles/${payload.vehicleId}?tab=reminders`,
    };
  }
}
