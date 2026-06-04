import type { AdminUserListResponse } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export interface AdminUsersQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

export async function getAdminUsers(params: AdminUsersQueryParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.page != null) query.set('page', String(params.page));
  if (params.limit != null) query.set('limit', String(params.limit));
  const qs = query.toString();
  const path = qs ? `${endpoints.admin.users}?${qs}` : endpoints.admin.users;
  const response = await apiClient.get<ApiSuccessResponse<AdminUserListResponse>>(path);
  return response.data;
}
