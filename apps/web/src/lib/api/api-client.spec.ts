import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './api-error';
import { apiClient, configureApiClient } from './api-client';

vi.mock('@/lib/env/env', () => ({
  getEnv: () => ({
    apiBaseUrl: 'https://vehiclevault.middle-earth.in/api',
  }),
}));

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    configureApiClient();
    vi.unstubAllGlobals();
  });

  it('preserves the /api prefix when building endpoint URLs', () => {
    const url = apiClient.buildUrl('/auth/register', {
      next: 'dashboard',
    });

    expect(String(url)).toBe(
      'https://vehiclevault.middle-earth.in/api/auth/register?next=dashboard',
    );
  });

  it('sends the bearer token on authenticated requests', async () => {
    const fetchMock = vi.mocked(fetch);
    configureApiClient({
      getAccessToken: () => 'jwt-token',
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      }),
    );

    await apiClient.post('/auth/login', {
      email: 'atharva@example.com',
      password: 'password123',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://vehiclevault.middle-earth.in/api/auth/login',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('refreshes the session and retries once after a 401 response', async () => {
    const fetchMock = vi.mocked(fetch);
    const refreshAccessToken = vi.fn().mockResolvedValue('next-access-token');
    const onUnauthorized = vi.fn();

    configureApiClient({
      getAccessToken: vi
        .fn()
        .mockReturnValueOnce('expired-access-token')
        .mockReturnValueOnce('next-access-token'),
      refreshAccessToken,
      onUnauthorized,
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: false }), {
          status: 401,
          headers: {
            'content-type': 'application/json',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { ok: true } }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }),
      );

    await expect(apiClient.get('/vehicles')).resolves.toEqual({
      success: true,
      data: { ok: true },
    });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        href: 'https://vehiclevault.middle-earth.in/api/vehicles',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer next-access-token',
        }),
      }),
    );
  });

  it('triggers the unauthorized handler on 401 responses', async () => {
    const fetchMock = vi.mocked(fetch);
    const onUnauthorized = vi.fn();
    configureApiClient({
      onUnauthorized,
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false }), {
        status: 401,
        headers: {
          'content-type': 'application/json',
        },
      }),
    );

    await expect(apiClient.get('/vehicles')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
