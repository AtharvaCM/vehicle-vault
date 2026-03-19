import type { ApiSuccessResponse } from '../types/api-response.type';

export function successResponse<TData, TMeta = undefined>(
  data: TData,
  meta?: TMeta,
): ApiSuccessResponse<TData, TMeta> {
  return meta === undefined ? { success: true, data } : { success: true, data, meta };
}

export function isSuccessResponse(value: unknown): value is ApiSuccessResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as { success?: unknown }).success === true &&
    'data' in value
  );
}
