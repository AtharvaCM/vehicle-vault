import type {
  UpdateVehicleCatalogOfferingReviewInput,
  VehicleCatalogPublishedOfferingReview,
} from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function updateVehicleCatalogOfferingReview(
  offeringId: string,
  input: UpdateVehicleCatalogOfferingReviewInput,
) {
  const response = await apiClient.patch<
    ApiSuccessResponse<VehicleCatalogPublishedOfferingReview>,
    UpdateVehicleCatalogOfferingReviewInput
  >(endpoints.vehicleCatalog.reviewOffering(offeringId), input);

  return response.data;
}
