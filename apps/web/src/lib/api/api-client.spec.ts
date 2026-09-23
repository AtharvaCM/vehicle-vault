import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './api-error';
import { apiClient, configureApiClient } from './api-client';
import { getApiErrorMessage } from './get-api-error-message';

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

  it('keeps the error a file download answers with, so the caller can say why', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message:
              'This file is no longer in storage. Delete the attachment and upload it again.',
          },
        }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      ),
    );

    const error = await apiClient.getBlob('/attachments/attachment-1/file').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(getApiErrorMessage(error, 'Could not open attachment')).toBe(
      'This file is no longer in storage. Delete the attachment and upload it again.',
    );
  });

  it('still fails a file download with no JSON body, with the generic message', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Bad gateway', { status: 502 }));

    const error = await apiClient.getBlob('/attachments/attachment-1/file').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(getApiErrorMessage(error, 'Could not open attachment')).toBe(
      'Could not open attachment',
    );
  });
});
