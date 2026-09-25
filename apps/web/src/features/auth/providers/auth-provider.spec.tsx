import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api/api-client';
import { ApiError } from '@/lib/api/api-error';
import { appToast } from '@/lib/toast';

import { getStoredAuthSession, setStoredAuthSession } from '../lib/auth-session-storage';

const api = vi.hoisted(() => ({
  getMe: vi.fn(),
  refreshSession: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../api/get-me', () => ({ getMe: api.getMe }));
vi.mock('../api/refresh-session', () => ({ refreshSession: api.refreshSession }));
vi.mock('../api/logout', () => ({ logout: api.logout }));
vi.mock('@/lib/toast', () => ({ appToast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));
const clearSavedPapers = vi.hoisted(() => vi.fn());
vi.mock('@/features/vehicle-documents/offline/saved-papers-store', () => ({ clearSavedPapers }));
vi.mock('@/lib/env/env', () => ({
  getEnv: () => ({ apiBaseUrl: 'https://api.example.test/api' }),
}));

import { useAuth } from '../hooks/use-auth';
import { AuthProvider } from './auth-provider';

function createToken(expSeconds: number) {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp: expSeconds })}.signature`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

const USER = {
  id: 'user-1',
  name: 'Atharva',
  email: 'atharva@example.com',
  role: 'user',
  emailVerified: true,
  allowedCatalogSources: [],
};

function storeSession({ accessTokenValid }: { accessTokenValid: boolean }) {
  setStoredAuthSession({
    accessToken: createToken(nowSeconds() + (accessTokenValid ? 3600 : -60)),
    refreshToken: createToken(nowSeconds() + 7 * 24 * 3600),
    user: USER,
  } as never);
}

function Status() {
  const auth = useAuth();
  return <p>status: {auth.status}</p>;
}

/** fetch rejects with a TypeError when there is no network at all. */
const offline = () => new TypeError('Failed to fetch');

describe('AuthProvider when the API cannot be reached', () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/home', replace },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens signed in offline, with the session it had', async () => {
    storeSession({ accessTokenValid: true });
    api.getMe.mockRejectedValue(offline());

    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );

    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();
    // Nothing asked the API for a new session, and nothing was thrown away.
    expect(api.refreshSession).not.toHaveBeenCalled();
    expect(getStoredAuthSession()?.refreshToken).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    // Offline is exactly when the saved papers are needed.
    expect(clearSavedPapers).not.toHaveBeenCalled();
  });

  it('keeps an expired session it could not refresh, rather than signing out', async () => {
    storeSession({ accessTokenValid: false });
    api.refreshSession.mockRejectedValue(offline());

    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );

    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();
    expect(getStoredAuthSession()?.refreshToken).toBeTruthy();
  });

  it('treats a server error like no answer at all', async () => {
    storeSession({ accessTokenValid: false });
    api.refreshSession.mockRejectedValue(new ApiError('Bad gateway', 502));

    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );

    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();
  });

  it('still signs out when the server refuses the session', async () => {
    storeSession({ accessTokenValid: false });
    api.refreshSession.mockRejectedValue(new ApiError('Invalid refresh token', 401));

    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );

    expect(await screen.findByText('status: anonymous')).toBeInTheDocument();
    expect(getStoredAuthSession()).toBeNull();
    expect(clearSavedPapers).toHaveBeenCalled();
  });

  it('keeps retrying the pre-expiry refresh while offline, then takes the new session', async () => {
    // A token already inside the refresh lead time, so the timer fires at once.
    setStoredAuthSession({
      accessToken: createToken(nowSeconds() + 30),
      refreshToken: createToken(nowSeconds() + 7 * 24 * 3600),
      user: USER,
    } as never);
    api.getMe.mockResolvedValue(USER);
    api.refreshSession.mockRejectedValueOnce(offline()).mockResolvedValueOnce({
      accessToken: createToken(nowSeconds() + 3600),
      refreshToken: createToken(nowSeconds() + 7 * 24 * 3600),
      user: USER,
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <AuthProvider>
        <Status />
      </AuthProvider>,
    );

    await waitFor(() => expect(api.refreshSession).toHaveBeenCalledTimes(1));
    expect(screen.getByText('status: authenticated')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();

    // Signal comes back: the retry succeeds and the session carries on.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => expect(api.refreshSession).toHaveBeenCalledTimes(2));
    expect(screen.getByText('status: authenticated')).toBeInTheDocument();
  });
});

function SignOut() {
  const auth = useAuth();
  return (
    <>
      <p>status: {auth.status}</p>
      <button onClick={auth.logout} type="button">
        Sign out
      </button>
    </>
  );
}

const unauthorizedResponse = () =>
  new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'No' } }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });

describe('AuthProvider when a request comes back 401', () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/home', replace },
    });
    api.getMe.mockResolvedValue(USER);
    api.logout.mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => unauthorizedResponse()),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('says nothing about an expired session after a deliberate sign-out', async () => {
    storeSession({ accessTokenValid: true });
    render(
      <AuthProvider>
        <SignOut />
      </AuthProvider>,
    );
    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByText('status: anonymous')).toBeInTheDocument();
    // The papers kept for offline go with the session.
    expect(clearSavedPapers).toHaveBeenCalled();

    // A query still mounted refetches with no token and is turned away.
    await expect(apiClient.get('/notifications')).rejects.toBeInstanceOf(ApiError);

    expect(appToast.info).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('still reports an expired session when the server refuses a live one', async () => {
    storeSession({ accessTokenValid: true });
    api.refreshSession.mockRejectedValue(new ApiError('Invalid refresh token', 401));
    render(
      <AuthProvider>
        <SignOut />
      </AuthProvider>,
    );
    expect(await screen.findByText('status: authenticated')).toBeInTheDocument();

    await act(async () => {
      await expect(apiClient.get('/notifications')).rejects.toBeInstanceOf(ApiError);
    });

    expect(appToast.info).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Session expired' }),
    );
    expect(screen.getByText('status: anonymous')).toBeInTheDocument();
    expect(replace).toHaveBeenCalled();
  });
});
