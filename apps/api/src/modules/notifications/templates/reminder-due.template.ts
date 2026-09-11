import { Injectable } from '@nestjs/common';

import { prefixedTitle } from './notification-title';
import type { AlertTemplate, ReminderDuePayload, RenderedNotification } from '../types';

const TITLE_PREFIX = 'Reminder Due Soon: ';

@Injectable()
export class ReminderDueTemplate implements AlertTemplate<'reminder-due'> {
  readonly kind = 'reminder-due' as const;

  dedupKey(payload: ReminderDuePayload): string {
    return `reminder-due:${payload.reminderId}`;
  }

  render(payload: ReminderDuePayload): RenderedNotification {
    const remainingKm = Math.round(payload.remainingDistanceKm);

    return {
      title: prefixedTitle(TITLE_PREFIX, payload.title),
      message: `Your vehicle is approaching ${payload.dueOdometer}km (approx. ${remainingKm}km left) for "${payload.title}".`,
      type: 'warning',
      link: `/vehicles/${payload.vehicleId}?tab=reminders`,
    };
  }
}
