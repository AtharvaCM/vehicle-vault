import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export interface PushPublicKeyResponse {
  available: boolean;
  publicKey: string | null;
}

export async function getPushPublicKey(): Promise<PushPublicKeyResponse> {
  const response = await apiClient.get<ApiSuccessResponse<PushPublicKeyResponse>>(
    endpoints.notifications.pushPublicKey(),
  );
  return response.data;
}

export async function subscribePush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<void> {
  await apiClient.post(endpoints.notifications.pushSubscribe(), subscription);
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await apiClient.delete(endpoints.notifications.pushSubscribe(), {
    body: { endpoint },
  });
}
