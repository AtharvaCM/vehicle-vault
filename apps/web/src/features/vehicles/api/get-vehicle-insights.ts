import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type VehicleOdometerInsight = {
  averageDailyMileage: number;
  averageMonthlyMileage: number;
  currentOdometerPredicted: number;
  lastRecordedOdometer: number;
  lastRecordedDate: string;
  daysSinceLastReading: number;
  dataPointsCount: number;
  confidence: 'low' | 'medium' | 'high';
};

export async function getVehicleInsights(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleOdometerInsight>>(
    endpoints.vehicles.insights(vehicleId),
  );

  return response.data;
}

export function vehicleInsightsQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: [...queryKeys.vehicles.detail(vehicleId), 'insights'],
    queryFn: () => getVehicleInsights(vehicleId),
  });
}
