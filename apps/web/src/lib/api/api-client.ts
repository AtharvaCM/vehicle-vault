import { ApiError } from './api-error';
import { getEnv } from '@/lib/env/env';

export type ApiSuccessResponse<TData, TMeta = unknown> = {
  success: true;
  data: TData;
  meta?: TMeta;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    path: string;
    timestamp: string;
  };
};

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type ApiRequestOptions<TBody = unknown> = {
  body?: TBody;
  headers?: HeadersInit;
  method?: HttpMethod;
  path: string;
  query?: QueryParams;
  signal?: AbortSignal;
};

type ApiClientConfiguration = {
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
};

let accessTokenResolver: (() => string | null) | null = null;
let unauthorizedHandler: (() => void) | null = null;

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function buildUrl(path: string, query?: QueryParams) {
  const normalizedPath = path.replace(/^\/+/, '');
  const { apiBaseUrl } = getEnv();
  const baseUrl = `${apiBaseUrl || window.location.origin}/`;
  const url = new URL(normalizedPath, baseUrl);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url;
}

async function parseResponse<TResponse>(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status === 204) {
    return null as TResponse;
  }

  if (contentType.includes('application/json')) {
    return (await response.json()) as TResponse;
  }

  return (await response.text()) as TResponse;
}

async function request<TResponse, TBody = unknown>({
  body,
  headers,
  method = 'GET',
  path,
  query,
  signal,
}: ApiRequestOptions<TBody>): Promise<TResponse> {
  const accessToken = accessTokenResolver?.();
  const response = await fetch(buildUrl(path, query), {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      ...(body && !isFormData(body) ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body ? (isFormData(body) ? body : JSON.stringify(body)) : undefined,
  });

  const payload = await parseResponse<unknown>(response);

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.();
    }

    throw new ApiError(
      `Request to ${path} failed with status ${response.status}`,
      response.status,
      payload,
    );
  }

  return payload as TResponse;
}

export function configureApiClient({
  getAccessToken,
  onUnauthorized,
}: ApiClientConfiguration = {}) {
  accessTokenResolver = getAccessToken ?? null;
  unauthorizedHandler = onUnauthorized ?? null;
}

export const apiClient = {
  request,
  buildUrl,
  get: <TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'path'>) =>
    request<TResponse>({ ...options, method: 'GET', path }),
  post: <TResponse, TBody>(
    path: string,
    body?: TBody,
    options?: Omit<ApiRequestOptions<TBody>, 'body' | 'method' | 'path'>,
  ) => request<TResponse, TBody>({ ...options, body, method: 'POST', path }),
  patch: <TResponse, TBody>(
    path: string,
    body?: TBody,
    options?: Omit<ApiRequestOptions<TBody>, 'body' | 'method' | 'path'>,
  ) => request<TResponse, TBody>({ ...options, body, method: 'PATCH', path }),
  delete: <TResponse>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'path'>) =>
    request<TResponse>({ ...options, method: 'DELETE', path }),
};
