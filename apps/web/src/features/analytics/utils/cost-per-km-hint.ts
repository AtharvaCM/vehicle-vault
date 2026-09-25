import { TCO_MIN_COST_PER_KM_DISTANCE_KM, type TcoResponse } from '@vehicle-vault/shared';

import { format } from '@/lib/format';

/**
 * Why ₹/km isn't shown yet, or the distance it was measured over when it is
 * (the #192 rule: a figure needs at least `TCO_MIN_COST_PER_KM_DISTANCE_KM`
 * of driving on file before it's trusted). Shared by `TcoCard` and
 * `VehicleSpendList` so the two never drift on the wording.
 */
export function costPerKmHint(
  tco: Pick<TcoResponse, 'derived' | 'purchaseOdometer' | 'kmSincePurchase'> & {
    totals?: Pick<TcoResponse['totals'], 'accessories'>;
  },
): string {
  if (tco.derived.costPerKm) {
    // Running cost: accessories are one-off buys, left out by the API.
    return Number(tco.totals?.accessories ?? 0) > 0
      ? `${format.distance(tco.kmSincePurchase)} · accessories left out`
      : format.distance(tco.kmSincePurchase);
  }
  if (tco.purchaseOdometer == null) return 'Add the odometer at purchase to see cost per km';
  return `${format.distance(tco.kmSincePurchase)} so far; shown from ${format.distance(TCO_MIN_COST_PER_KM_DISTANCE_KM)}`;
}
