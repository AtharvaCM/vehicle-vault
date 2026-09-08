import { Injectable } from '@nestjs/common';

import type {
  AlertTemplate,
  NotificationUrgency,
  RenderedNotification,
  TyreAgedPayload,
} from '../types';
import { positionLabel } from './tyre-labels';

type AgedLevel = TyreAgedPayload['level'];

const TITLES: Record<AgedLevel, string> = {
  replace: 'Tyre Aged Out',
  warn: 'Tyre Ageing',
};

const ACTIONS: Record<AgedLevel, string> = {
  replace: 'Age replaces a tyre on its own, however much tread is left.',
  warn: 'Check the sidewalls for cracking at your next service.',
};

const URGENCIES: Record<AgedLevel, NotificationUrgency> = {
  replace: 'warning',
  warn: 'info',
};

/**
 * The alert a distance-based service schedule structurally cannot produce: a
 * tyre that has covered barely any kilometres can still be too old to trust,
 * and nothing about the odometer will ever say so.
 */
@Injectable()
export class TyreAgedTemplate implements AlertTemplate<'tyre-aged'> {
  readonly kind = 'tyre-aged' as const;

  /** Same rhythm as {@link TyreWornTemplate}: once per grade, not once per cron run. */
  dedupKey(payload: TyreAgedPayload): string {
    return `tyre-aged:${payload.tyreId}:${payload.level}`;
  }

  render(payload: TyreAgedPayload): RenderedNotification {
    const label = positionLabel(payload.position);

    return {
      title: `${TITLES[payload.level]}: ${label}`,
      message: `${label} tyre: ${payload.summary} ${ACTIONS[payload.level]}`,
      type: URGENCIES[payload.level],
      link: `/vehicles/${payload.vehicleId}?tab=tyres`,
    };
  }
}
