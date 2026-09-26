import { queryOptions } from '@tanstack/react-query';
import type { ContactMessage, ContactMessageInput } from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

/** Sends a message from the Contact page; the API stores it before anything else. */
export async function sendContactMessage(input: ContactMessageInput) {
  const response = await apiClient.post<
    ApiSuccessResponse<{ received: true }>,
    ContactMessageInput
  >(endpoints.contact, input);
  return response.data;
}

/** The admin area's list of Contact page messages, newest first. */
export function contactMessagesQueryOptions() {
  return queryOptions({
    queryKey: ['admin', 'contact-messages'] as const,
    queryFn: async () =>
      (await apiClient.get<ApiSuccessResponse<ContactMessage[]>>(endpoints.admin.contactMessages))
        .data,
  });
}
