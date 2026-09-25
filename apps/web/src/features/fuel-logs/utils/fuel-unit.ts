import { FuelType } from '@vehicle-vault/shared';

/** What a fill's quantity is measured in, following the vehicle's fuel type. */
export type FuelQuantityUnit = 'L' | 'kg' | 'kWh';

/**
 * Litres for anything burned (petrol, diesel, hybrid, LPG…), kg for CNG, sold
 * by weight, and kWh for an EV, metered like any other charge. Kept in step
 * with the API's `fuelEconomyUnit` (`apps/api/src/modules/vehicles/fuel-economy.ts`).
 */
export function fuelQuantityUnit(fuelType: FuelType | null | undefined): FuelQuantityUnit {
  if (fuelType === FuelType.CNG) return 'kg';
  if (fuelType === FuelType.Electric) return 'kWh';
  return 'L';
}

/** An EV is charged, not fuelled: the word the dialog and the log both use. */
export function fuelNoun(fuelType: FuelType | null | undefined): 'Fuel' | 'Charge' {
  return fuelType === FuelType.Electric ? 'Charge' : 'Fuel';
}

/**
 * Whether "full tank" means anything for this fuel type. An EV is charged to
 * whatever level is wanted, not filled, so the toggle (and the economy note
 * that goes with it) has nothing to say for one.
 */
export function supportsFullTank(fuelType: FuelType | null | undefined): boolean {
  return fuelType !== FuelType.Electric;
}
