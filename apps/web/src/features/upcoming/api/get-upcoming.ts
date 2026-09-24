import type { UpcomingKindFilter, UpcomingTimeline } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

/** How many `later` rows each page brings. */
export const UPCOMING_LATER_PAGE_SIZE = 20;

export type UpcomingFilters = {
  vehicleId?: string;
  kind?: UpcomingKindFilter;
};

type UpcomingMeta = { page: number; limit: number; total: number };

export type UpcomingPage = UpcomingTimeline & {
  page: number;
  /** Rows in the `later` group across every page. */
  laterTotal: number;
};

export async function getUpcoming(filters: UpcomingFilters, page = 1): Promise<UpcomingPage> {
  const response = await apiClient.get<ApiSuccessResponse<UpcomingTimeline, UpcomingMeta>>(
    endpoints.upcoming.timeline,
    {
      query: {
        vehicleId: filters.vehicleId,
        kind: filters.kind,
        page,
        limit: UPCOMING_LATER_PAGE_SIZE,
      },
    },
  );

  return {
    ...response.data,
    page,
    laterTotal: response.meta?.total ?? response.data.counts.later,
  };
}
