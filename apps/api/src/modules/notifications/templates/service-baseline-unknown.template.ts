import { Injectable } from '@nestjs/common';
import { SERVICE_HISTORY_PROMPT_KM } from '@vehicle-vault/shared';

import type { AlertTemplate, RenderedNotification, ServiceBaselineUnknownPayload } from '../types';

function formatCategoryLabel(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function km(value: number): string {
  return `${Math.max(0, Math.round(value)).toLocaleString('en-IN')} km`;
}

/**
 * Informational, like the tyre inspection prompt: nothing here says a vehicle is
 * unsafe, only that the app has been given no way to tell. Dressing a gap in
 * knowledge up as a fault is how people learn to dismiss the alerts that matter.
 */
@Injectable()
export class ServiceBaselineUnknownTemplate implements AlertTemplate<'service-baseline-unknown'> {
  readonly kind = 'service-baseline-unknown' as const;

  /**
   * Bucketed by distance, so an unanswered question is re-asked at roughly the
   * rhythm at which it matters — every service interval for a category, every
   * prompt threshold for a whole vehicle — rather than every morning.
   *
   * A category with a 30 000 km interval therefore nags far less often than one
   * with a 7 500 km interval, which is the correct relative urgency and falls
   * out of the interval itself instead of a second table of numbers.
   */
  dedupKey(payload: ServiceBaselineUnknownPayload): string {
    if (payload.scope === 'vehicle') {
      const bucket = Math.floor(payload.odometer / SERVICE_HISTORY_PROMPT_KM);
      return `service-baseline-unknown:${payload.vehicleId}:vehicle:${bucket}`;
    }

    const bucket = Math.floor(payload.odometer / payload.intervalKm);
    return `service-baseline-unknown:${payload.vehicleId}:${payload.category}:${bucket}`;
  }

  render(payload: ServiceBaselineUnknownPayload): RenderedNotification {
    const link = `/vehicles/${payload.vehicleId}?tab=maintenance`;

    if (payload.scope === 'vehicle') {
      return {
        title: 'Add This Vehicle’s Service History',
        message: `This vehicle has covered ${km(
          payload.odometer,
        )} with no service history on file. Until something is recorded, reminders are timed from the day it was added — which quietly assumes everything had just been done. Tell the app what you know, including what you don’t.`,
        type: 'info',
        link,
      };
    }

    const label = formatCategoryLabel(payload.category);

    return {
      title: `Unknown Service History: ${label}`,
      message: `Nothing on record for when ${label.toLowerCase()} was last done on this vehicle, so no reminder can be timed against it. Have it checked at the next service and log it — after that the app can take over.`,
      type: 'info',
      link,
    };
  }
}
