import type { FuelEconomyUnit, VehicleFuelEconomy } from '@vehicle-vault/shared';
import { FuelType } from '@vehicle-vault/shared';

type FuelFill = { odometer: number; quantity: number; date: Date; isFullTank?: boolean };

/** A CNG fill is weighed, an EV charge metered; everything else is sold by the litre. */
export function fuelEconomyUnit(fuelType: FuelType): FuelEconomyUnit {
  if (fuelType === FuelType.CNG) return 'km/kg';
  if (fuelType === FuelType.Electric) return 'km/kWh';
  return 'km/L';
}

/**
 * The fills a figure can be measured over: in odometer order, each with fuel in
 * it and a reading past the one before. An odometer of 0 means the reading was
 * not recorded, and would count the vehicle's whole life as one interval. A
 * fill that repeats or goes back on an earlier reading is a typo or a
 * duplicate, and would divide by nothing.
 */
function usableFills(fills: FuelFill[]): FuelFill[] {
  const ordered = [...fills]
    .filter((fill) => fill.quantity > 0 && fill.odometer > 0)
    .sort((a, b) => a.odometer - b.odometer || a.date.getTime() - b.date.getTime());

  const usable: FuelFill[] = [];
  for (const fill of ordered) {
    const previous = usable.at(-1);
    if (!previous || fill.odometer > previous.odometer) usable.push(fill);
  }
  return usable;
}

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * Achieved economy, full tank to full tank: the distance from the first usable
 * full fill to the last, over all the fuel bought after the first, top-ups
 * included. The first full fill's fuel went into driving before the measuring
 * began, so it is not counted, and neither are top-ups before it; top-ups after
 * the last full fill are fuel still in the tank. A fill with no flag counts as
 * full.
 *
 * With fewer than two full fills (a vehicle logged only as top-ups) there is no
 * known level at either end, so the run is measured from the first usable fill
 * to the last instead: the skew of not knowing the levels evens out over a long
 * run. A single fill never gives a number.
 *
 * The claim is only compared in the same unit, and a catalog "combined" figure
 * for an electric vehicle is usually its range, so an EV shows no claim.
 */
export function computeFuelEconomy(
  fills: FuelFill[],
  fuelType: FuelType,
  claimedCombined: number | null,
): VehicleFuelEconomy {
  const unit = fuelEconomyUnit(fuelType);
  const usable = usableFills(fills);
  const claimed =
    unit !== 'km/kWh' && claimedCombined && claimedCombined > 0 ? claimedCombined : null;

  const isFull = (fill: FuelFill) => fill.isFullTank !== false;
  const fullIndexes = usable.flatMap((fill, index) => (isFull(fill) ? [index] : []));
  const twoFull = fullIndexes.length >= 2;
  const start = twoFull ? (fullIndexes[0] ?? 0) : 0;
  const end = twoFull ? (fullIndexes.at(-1) ?? 0) : usable.length - 1;
  const first = usable[start];
  const last = usable[end];
  const quantity = usable
    .slice(start + 1, end + 1)
    .reduce((total, fill) => total + fill.quantity, 0);

  if (usable.length < 2 || !first || !last || quantity <= 0) {
    return { unit, usableFills: usable.length, achieved: null, claimed, differencePercent: null };
  }

  const distanceKm = last.odometer - first.odometer;
  const value = round(distanceKm / quantity, 1);

  return {
    unit,
    usableFills: usable.length,
    achieved: { value, distanceKm, quantity: round(quantity, 2) },
    claimed,
    differencePercent: claimed ? Math.round(((value - claimed) / claimed) * 100) : null,
  };
}
