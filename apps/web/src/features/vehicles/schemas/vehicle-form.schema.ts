import { FuelType } from '@vehicle-vault/shared';
import { z } from 'zod';

export const vehicleFormSchema = z.object({
  registrationNumber: z.string().trim().min(1, 'Registration number is required'),
  make: z.string().trim().min(1, 'Make is required'),
  model: z.string().trim().min(1, 'Model is required'),
  variant: z.string().trim().min(1, 'Variant is required'),
  year: z.number().int().min(1900, 'Enter a valid year').max(2100, 'Enter a valid year'),
  fuelType: z.nativeEnum(FuelType),
  odometer: z.number().nonnegative('Odometer cannot be negative'),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
