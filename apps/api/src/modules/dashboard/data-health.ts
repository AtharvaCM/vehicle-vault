import {
  requiresPuc,
  type DashboardDataGap,
  type DashboardDocumentState,
  type DashboardVehicleDataHealth,
  type FuelType,
} from '@vehicle-vault/shared';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A reading older than this has stopped describing the vehicle. At the
 * thousand-odd kilometres a month an Indian car covers, a month is the whole
 * width of the window in which an odometer reminder enters the queue.
 */
export const ODOMETER_FRESH_DAYS = 30;

/**
 * What each fact is worth, out of 100, by how much of what the app tells the
 * owner depends on it. The score is the weighted share of the checks that apply
 * to the vehicle it passes, and the gap it names is the one worth the most.
 * The order here breaks ties.
 */
export const DATA_HEALTH_WEIGHTS: Record<DashboardDataGap, number> = {
  // Every distance reminder and alert is timed from when each service was last
  // done. Without it the engine measures from the day the vehicle was added,
  // which quietly assumes everything had just been done. Earned per category
  // answered, since each answer makes one more schedule true.
  service_history: 25,
  // Every odometer-driven status, alert and forecast trusts the reading, and a
  // stale one moves all of them at once.
  odometer: 20,
  // Legally required to drive, and the costliest renewal the app watches.
  insurance: 15,
  // The catalog link swaps generic service intervals for the manufacturer's
  // own, and fills in the specs the vehicle page and forecasts read.
  catalog_link: 15,
  // Legally required for a combustion vehicle, but cheaper and quicker to fix
  // than insurance. An electric vehicle is exempt, so it is not asked.
  puc: 10,
  // Tread and age are the wear limits no service schedule can see; without
  // the tyres on file, nothing watches them.
  tyres: 10,
  // Only the cost-of-ownership and resale figures use it. Nothing about when
  // anything is due depends on it.
  purchase_price: 5,
};

export type DataHealthInput = {
  fuelType: FuelType;
  catalogVariantId?: string | null;
  purchasePrice: number | null;
  /** Service categories that apply to the vehicle, and those with neither a record nor a baseline. */
  serviceCategories: number;
  unansweredServiceCategories: number;
  insurance: DashboardDocumentState;
  puc: DashboardDocumentState;
  odometerUpdatedAt: Date;
  /** At least one road tyre on file; a spare alone tells the app nothing about wear. */
  roadTyresTracked: boolean;
  now: Date;
};

/** A document is on file when a current one is: an expired policy says nothing about today. */
const isCurrent = (state: DashboardDocumentState) => state === 'active' || state === 'expiring';

/**
 * The share of each check still missing, 0 to 1; null where the check does not
 * apply to this vehicle.
 */
function missingShare(input: DataHealthInput): Record<DashboardDataGap, number | null> {
  return {
    service_history:
      input.serviceCategories > 0 ? input.unansweredServiceCategories / input.serviceCategories : 0,
    odometer:
      input.now.getTime() - input.odometerUpdatedAt.getTime() > ODOMETER_FRESH_DAYS * MS_PER_DAY
        ? 1
        : 0,
    insurance: isCurrent(input.insurance) ? 0 : 1,
    catalog_link: input.catalogVariantId ? 0 : 1,
    puc: requiresPuc(input.fuelType) ? (isCurrent(input.puc) ? 0 : 1) : null,
    tyres: input.roadTyresTracked ? 0 : 1,
    purchase_price: input.purchasePrice != null ? 0 : 1,
  };
}

export function computeDataHealth(input: DataHealthInput): DashboardVehicleDataHealth {
  const missing = missingShare(input);
  let possible = 0;
  let lost = 0;
  let nextGap: DashboardDataGap | null = null;
  let nextGapWorth = 0;

  for (const [gap, weight] of Object.entries(DATA_HEALTH_WEIGHTS) as [DashboardDataGap, number][]) {
    const share = missing[gap];
    if (share === null) continue;

    possible += weight;
    lost += weight * share;
    // Strictly greater, so a tie goes to the check listed first.
    if (weight * share > nextGapWorth) {
      nextGap = gap;
      nextGapWorth = weight * share;
    }
  }

  const score = Math.round((100 * (possible - lost)) / possible);

  // Complete means nothing is missing, so a small gap never rounds up to 100.
  return { score: nextGap ? Math.min(score, 99) : 100, nextGap };
}
