import type { FuelLog } from '@vehicle-vault/shared';

/**
 * The economy each fill earned against the one before it: the distance since
 * the previous fill over the fuel this fill put back. Measured the way the
 * API's `computeFuelEconomy` measures the whole run
 * (`apps/api/src/modules/vehicles/fuel-economy.ts`): fills in odometer order,
 * skipping any with no fuel, no reading (0), or a reading that does not move
 * past the fill before. The first usable fill has nothing to measure against,
 * so it earns no figure. Keyed by fill id; one decimal place.
 */
export function fillEconomy(logs: FuelLog[]): Map<string, number> {
  const ordered = [...logs]
    .filter((log) => log.quantity > 0 && log.odometer > 0)
    .sort(
      (a, b) => a.odometer - b.odometer || new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

  const economy = new Map<string, number>();
  let previous: FuelLog | undefined;
  for (const log of ordered) {
    if (previous && log.odometer <= previous.odometer) continue;
    if (previous) {
      economy.set(
        log.id,
        Math.round(((log.odometer - previous.odometer) / log.quantity) * 10) / 10,
      );
    }
    previous = log;
  }
  return economy;
}
