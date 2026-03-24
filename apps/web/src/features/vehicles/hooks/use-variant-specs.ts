import { useQuery } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type VehicleVariantSpec = {
  id: string;
  variantId: string;
  engineCc: number | null;
  engineCyl: number | null;
  engineType: string | null;
  engineFuel: string | null;
  powerPs: number | null;
  powerRpm: number | null;
  torqueNm: number | null;
  torqueRpm: number | null;
  transmission: string | null;
  driveType: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  wheelbaseMm: number | null;
  kerbWeightKg: number | null;
  grossWeightKg: number | null;
  bootSpaceLitres: number | null;
  groundClearanceMm: number | null;
  turningRadiusM: number | null;
  topSpeedKph: number | null;
  mileageCity: number | null;
  mileageHighway: number | null;
  mileageCombined: number | null;
  fuelCapLitres: number | null;
  seatingCapacity: number | null;
  bodyType: string | null;
  doors: number | null;
  tyreSize: string | null;
  wheelType: string | null;
  wheelSizeInch: number | null;
  airbagCount: number | null;
  safetyFeatures: string | null;
};

async function getVariantSpecs(make: string, model: string, variant: string) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleVariantSpec | null>>(
    endpoints.vehicleCatalog.specs,
    {
      query: { make, model, variant },
    },
  );
  return response.data;
}

export function useVariantSpecs(make: string, model: string, variant: string) {
  return useQuery({
    queryKey: queryKeys.vehicleCatalog.variantSpecs(make, model, variant),
    queryFn: () => getVariantSpecs(make, model, variant),
    enabled: Boolean(make && model && variant),
    staleTime: 1000 * 60 * 30, // Specs don't change often
  });
}
