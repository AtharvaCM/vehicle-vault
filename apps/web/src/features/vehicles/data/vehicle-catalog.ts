import { VehicleType } from '@vehicle-vault/shared';

const supportedCatalogTypes = new Set<VehicleType>([
  VehicleType.Car,
  VehicleType.SUV,
  VehicleType.Motorcycle,
]);

export function supportsVehicleCatalog(vehicleType: VehicleType) {
  return supportedCatalogTypes.has(vehicleType);
}
