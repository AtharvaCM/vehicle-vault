import { Injectable } from '@nestjs/common';
import { TYRE_INSPECTION_INTERVAL_KM } from '@vehicle-vault/shared';

import type { AlertTemplate, RenderedNotification, TyreUninspectedPayload } from '../types';

function km(value: number): string {
  return `${Math.max(0, Math.round(value)).toLocaleString('en-IN')} km`;
}

/**
 * "Nobody has looked" rather than "something is wrong", so this stays `info`.
 * Overstating an absence of data as a fault is how a safety alert becomes
 * something people learn to swipe away.
 */
@Injectable()
export class TyreUninspectedTemplate implements AlertTemplate<'tyre-uninspected'> {
  readonly kind = 'tyre-uninspected' as const;

  /**
   * Bucketed by odometer, at the inspection interval. Every other alert here is
   * keyed to a thing that changes state; this one is keyed to an absence, which
   * would otherwise re-raise every day the user leaves it unread. Tying the
   * bucket to distance means the nudge repeats only once the vehicle has covered
   * enough ground for it to be worth saying again.
   */
  dedupKey(payload: TyreUninspectedPayload): string {
    const bucket = Math.floor(payload.odometer / TYRE_INSPECTION_INTERVAL_KM);
    return `tyre-uninspected:${payload.vehicleId}:${payload.reason}:${bucket}`;
  }

  render(payload: TyreUninspectedPayload): RenderedNotification {
    const link = `/vehicles/${payload.vehicleId}?tab=tyres`;

    if (payload.reason === 'untracked') {
      return {
        title: 'Tyres Not Tracked',
        message: `This vehicle has covered ${km(
          payload.odometer,
        )} and has no tyres recorded, so nothing is watching tread or age. Add the fitted set — the DOT code and one tread reading are enough to start.`,
        type: 'info',
        link,
      };
    }

    const days = Math.max(0, Math.round(payload.daysSinceLastCheck));

    return {
      title: 'Time to Check the Tyres',
      message: `It has been ${km(payload.kmSinceLastCheck)} and ${days} day${
        days === 1 ? '' : 's'
      } since this vehicle's tyres were last measured. Log a tread depth and pressure reading so wear can still be tracked.`,
      type: 'info',
      link,
    };
  }
}
