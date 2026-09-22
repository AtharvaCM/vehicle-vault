import { Injectable } from '@nestjs/common';

import type { AlertTemplate, RenderedNotification, WarrantyOdometerPayload } from '../types';
import { prefixedTitle } from './notification-title';

/** Whether the limit is still ahead or already behind; each is said once. */
export function warrantyDistancePhase(remainingKm: number): 'approaching' | 'passed' {
  return remainingKm > 0 ? 'approaching' : 'passed';
}

const km = (value: number) => `${Math.round(value).toLocaleString('en-IN')} km`;

/**
 * A warranty's distance limit, in the terms the owner acts on: how far is left
 * while there is still time to book warranty work, then that it has been
 * passed. Deduped per warranty and phase, the way maintenance-due dedups per
 * category, so the daily run says each thing once rather than every day.
 */
@Injectable()
export class WarrantyOdometerTemplate implements AlertTemplate<'warranty-odometer'> {
  readonly kind = 'warranty-odometer' as const;

  dedupKey(payload: WarrantyOdometerPayload): string {
    return `warranty-odometer:${payload.warranty.id}:${warrantyDistancePhase(payload.remainingKm)}`;
  }

  render(payload: WarrantyOdometerPayload): RenderedNotification {
    const { remainingKm, warranty } = payload;
    const which = `${warranty.type.toLowerCase()} warranty with ${warranty.provider}`;

    if (warrantyDistancePhase(remainingKm) === 'approaching') {
      return {
        title: prefixedTitle('Warranty Ending Soon: ', warranty.provider),
        message: `Your ${which} ends at ${km(warranty.endOdometer)}, about ${km(remainingKm)} from now. Book any warranty work before you pass it.`,
        type: 'warning',
        link: `/vehicles/${warranty.vehicleId}?tab=protection`,
      };
    }

    return {
      title: prefixedTitle('Warranty Distance Reached: ', warranty.provider),
      message: `Your vehicle has passed the ${km(warranty.endOdometer)} limit of its ${which}. Work from here on is no longer covered.`,
      type: 'warning',
      link: `/vehicles/${warranty.vehicleId}?tab=protection`,
    };
  }
}
