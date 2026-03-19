import { VehicleCreateSchema, type CreateVehicleInput } from '@vehicle-vault/shared';

export const vehicleFormSchema = VehicleCreateSchema;

export type VehicleFormValues = CreateVehicleInput;
