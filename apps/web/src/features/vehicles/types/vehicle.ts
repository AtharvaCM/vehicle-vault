import { FuelType } from '@vehicle-vault/shared';

export type VehicleSummary = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  fuelType: FuelType;
  odometer: number;
  lastServiceDate?: string;
};
