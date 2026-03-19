import type { CreateVehicleInput } from '@vehicle-vault/shared';

export type VehicleRecord = CreateVehicleInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};
