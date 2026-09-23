import type { Vehicle } from '@vehicle-vault/shared';

/**
 * The name a vehicle is known by across the UI: its nickname when the owner
 * set one, otherwise its make and model.
 */
export function getVehicleDisplayName(
  vehicle: Pick<Vehicle, 'make' | 'model' | 'nickname'>,
): string {
  return vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
}
