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
    return `${this.cooldownKey(payload)}${bucket}`;
  }

  /** The dedup key without its bucket: this vehicle, this reason, any odometer. */
  cooldownKey(payload: TyreUninspectedPayload): string {
    return `tyre-uninspected:${payload.vehicleId}:${payload.reason}:`;
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
    const since = `${km(payload.kmSinceLastCheck)} and ${days} day${days === 1 ? '' : 's'}`;
    const mm = `${payload.projectedTreadMm.toFixed(1)} mm`;

    return {
      title: 'Time to Check the Tyres',
      message: this.message(payload.trigger, payload.measured, since, mm),
      type: 'info',
      link,
    };
  }

  /**
   * Says what the app actually knows. A tyre nobody has measured is "not
   * measured since it was fitted", never "last measured"; a request driven by
   * the wear projection gives the estimate it is asking to have checked.
   */
  private message(trigger: 'wear' | 'time', measured: boolean, since: string, mm: string): string {
    if (trigger === 'wear') {
      return measured
        ? `At the wear rate so far, this vehicle's tyres should be down to about ${mm} of tread, ${since} after the last reading. Measure them to confirm before planning a replacement.`
        : `This vehicle's tyres have not been measured since they were fitted, ${since} ago. At typical wear they should be near ${mm} of tread by now. Measure them so the estimate follows your own driving.`;
    }

    return measured
      ? `Nobody has looked at this vehicle's tyres for a year: the last reading was ${since} ago. Check the pressures, look for cuts or bulges, and log a tread reading.`
      : `This vehicle's tyres have not been looked at since they were fitted, ${since} ago. A year on, check the pressures, look for cuts or bulges, and log a tread reading.`;
  }
}
