import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';

export type OAuthProvider = 'google' | 'github';

export async function getOAuthProviders(): Promise<OAuthProvider[]> {
  try {
    const response = await apiClient.get<ApiSuccessResponse<{ providers: OAuthProvider[] }>>(
      '/auth/oauth/providers',
    );
    return response.data.providers;
  } catch {
    return [];
  }
}

export function oauthProvidersQueryOptions() {
  return queryOptions({
    queryKey: ['auth', 'oauth-providers'],
    queryFn: getOAuthProviders,
    staleTime: 5 * 60 * 1000,
  });
}
