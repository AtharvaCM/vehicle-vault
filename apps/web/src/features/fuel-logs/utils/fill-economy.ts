import type { FuelLog } from '@vehicle-vault/shared';

/**
 * The economy each full fill earned since the full fill before it: the
 * distance between the two, over all the fuel put in after the earlier one,
 * top-ups included. A top-up (`isFullTank: false`) leaves the tank at an
 * unknown level, so it earns no figure of its own; its fuel is counted at the
 * next full fill instead. A fill with no flag counts as full.
 *
 * Fills are taken the way the API's `computeFuelEconomy` takes them
 * (`apps/api/src/modules/vehicles/fuel-economy.ts`): in odometer order,
 * skipping any with no fuel, no reading (0), or a reading that does not move
 * past the fill before. The first full fill has nothing to measure against, and
 * top-ups before it went into driving before the measuring began, so neither
 * earns a figure. Keyed by fill id; one decimal place.
 */
export function fillEconomy(logs: FuelLog[]): Map<string, number> {
  const ordered = [...logs]
    .filter((log) => log.quantity > 0 && log.odometer > 0)
    .sort(
      (a, b) => a.odometer - b.odometer || new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

  const economy = new Map<string, number>();
  let previous: FuelLog | undefined;
  let lastFull: FuelLog | undefined;
  let fuelSinceFull = 0;
  for (const log of ordered) {
    if (previous && log.odometer <= previous.odometer) continue;
    previous = log;

    fuelSinceFull += log.quantity;
    if (log.isFullTank === false) continue;

    if (lastFull) {
      economy.set(
        log.id,
        Math.round(((log.odometer - lastFull.odometer) / fuelSinceFull) * 10) / 10,
      );
    }
    lastFull = log;
    fuelSinceFull = 0;
  }
  return economy;
}
