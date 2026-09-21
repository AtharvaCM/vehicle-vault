import type { Vehicle } from '@vehicle-vault/shared';

/**
 * "Bajaj Pulsar NS 200 ABS", or just the make and model when no variant is on
 * file — the variant is optional, and a bare separator reads like a missing word.
 */
export function describeVehicleModel(vehicle: Pick<Vehicle, 'make' | 'model' | 'variant'>): string {
  return [vehicle.make, vehicle.model, vehicle.variant?.trim()].filter(Boolean).join(' ');
}
