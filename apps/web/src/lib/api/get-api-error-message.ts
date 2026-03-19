import { type ApiErrorResponse } from './api-client';
import { ApiError } from './api-error';

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

export function getApiErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE) {
  if (error instanceof ApiError) {
    const payload = error.data as ApiErrorResponse | null;

    return payload?.error.message ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
