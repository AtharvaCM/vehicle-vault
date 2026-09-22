import type { FuelEconomyUnit, VehicleFuelEconomy } from '@vehicle-vault/shared';
import { FuelType } from '@vehicle-vault/shared';

type FuelFill = { odometer: number; quantity: number; date: Date };

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
 * Achieved economy, fill to fill: the distance from the first usable fill to
 * the last, over the fuel bought after the first. The first fill's fuel went
 * into driving before the logs began, so it is not counted. The logs carry no
 * "full tank" flag, so a partial fill skews one interval; measured across the
 * whole run, the skew evens out, which is why a single fill never gives a
 * number.
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

  const first = usable[0];
  const last = usable.at(-1);
  const quantity = usable.slice(1).reduce((total, fill) => total + fill.quantity, 0);

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
