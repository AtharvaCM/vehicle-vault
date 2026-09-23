import { type ApiErrorResponse } from './api-client';
import { ApiError } from './api-error';

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export function getApiErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE) {
  if (error instanceof ApiError) {
    // Not every error body is the API's envelope: a proxy in front can answer
    // a 502 with plain text or HTML.
    const payload = error.data as Partial<ApiErrorResponse> | string | null;
    const message = typeof payload === 'object' ? payload?.error?.message : undefined;

    return message ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
