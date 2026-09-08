import { Injectable } from '@nestjs/common';

import type {
  AlertableTyreLevel,
  AlertTemplate,
  NotificationUrgency,
  RenderedNotification,
  TyreWornPayload,
} from '../types';
import { positionLabel } from './tyre-labels';

const TITLES: Record<AlertableTyreLevel, string> = {
  illegal: 'Tyre Not Roadworthy',
  replace: 'Replace Tyre',
  warn: 'Tyre Wearing Down',
};

const ACTIONS: Record<AlertableTyreLevel, string> = {
  illegal: 'Replace it before driving further.',
  replace: 'Book a replacement.',
  warn: 'Worth budgeting for a new set.',
};

/**
 * `illegal` is an error rather than a warning on purpose: it is a statement
 * about roadworthiness, not a maintenance recommendation, and it should not
 * arrive looking like a service reminder.
 */
const URGENCIES: Record<AlertableTyreLevel, NotificationUrgency> = {
  illegal: 'error',
  replace: 'warning',
  warn: 'info',
};

@Injectable()
export class TyreWornTemplate implements AlertTemplate<'tyre-worn'> {
  readonly kind = 'tyre-worn' as const;

  /**
   * Keyed by level, so one tyre notifies once per grade it reaches rather than
   * once per reading. A tyre crossing from `replace` into `illegal` is a new
   * fact and gets through; a second measurement at the same grade does not.
   */
  dedupKey(payload: TyreWornPayload): string {
    return `tyre-worn:${payload.tyreId}:${payload.level}`;
  }

  render(payload: TyreWornPayload): RenderedNotification {
    const label = positionLabel(payload.position);

    return {
      title: `${TITLES[payload.level]}: ${label}`,
      message: `${label} tyre: ${payload.summary} ${ACTIONS[payload.level]}`,
      type: URGENCIES[payload.level],
      link: `/vehicles/${payload.vehicleId}?tab=tyres`,
    };
  }
}
