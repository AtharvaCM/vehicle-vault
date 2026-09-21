type VehicleNameParts = { make: string; model: string; variant?: string | null };

/** "Hyundai Creta SX", or the make and model alone when the vehicle has no variant. */
export function vehicleModelLine(vehicle: VehicleNameParts): string {
  return [vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(' ');
}

/** The row label, so a report never promises a variant it is not printing. */
export function vehicleModelLabel(vehicle: Pick<VehicleNameParts, 'variant'>): string {
  return vehicle.variant ? 'Make / Model / Variant' : 'Make / Model';
}
