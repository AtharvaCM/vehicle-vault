import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CATALOG_INTENT_TTL_MS,
  readCatalogIntent,
  saveCatalogIntent,
  type CatalogIntent,
} from '@/features/catalog-intent/lib/catalog-intent';

const auth = vi.hoisted(() => ({ current: { setSession: vi.fn() } }));
const getMe = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('../hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('../api/get-me', () => ({ getMe }));
vi.mock('@/lib/toast', () => ({ appToast: toast }));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));

import { OAuthCallbackPage } from './oauth-callback-page';

const intent: CatalogIntent = {
  segment: 'cars',
  make: 'honda',
  model: 'city',
  generation: 'city-lineup',
  variant: 'v-cvt',
};

const me = {
  id: 'user-1',
  name: 'Asha',
  email: 'asha@example.test',
  role: 'user',
  emailVerified: true,
  allowedCatalogSources: [],
  emailVerificationDueAt: null,
};

function arriveWith(fragment: string) {
  window.history.replaceState(null, '', `/auth/oauth-callback#${fragment}`);
}

describe('OAuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    auth.current = { setSession: vi.fn() };
    getMe.mockResolvedValue(me);
    navigate.mockResolvedValue(undefined);
  });

  it('takes a visitor who pressed Track this vehicle on to the add-vehicle form', async () => {
    saveCatalogIntent(intent);
    arriveWith('accessToken=access&refreshToken=refresh');

    render(<OAuthCallbackPage />);

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: '/vehicles/new', replace: true }),
    );
    expect(auth.current.setSession).toHaveBeenLastCalledWith({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: me,
    });
    // Signed in with the real user before the guarded route is entered.
    expect(auth.current.setSession.mock.invocationCallOrder.at(-1)).toBeLessThan(
      navigate.mock.invocationCallOrder[0]!,
    );
    // Left for the form to use up, not spent here.
    expect(readCatalogIntent()).toEqual(intent);
    expect(toast.success).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/start tracking it/) }),
    );
    // Tokens do not stay in the address.
    expect(window.location.hash).toBe('');
  });

  it('opens the dashboard when no intent is waiting', async () => {
    arriveWith('accessToken=access&refreshToken=refresh');

    render(<OAuthCallbackPage />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/dashboard', replace: true }));
  });

  it('opens the dashboard when the intent has expired', async () => {
    saveCatalogIntent(intent, Date.now() - CATALOG_INTENT_TTL_MS - 1);
    arriveWith('accessToken=access&refreshToken=refresh');

    render(<OAuthCallbackPage />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/dashboard', replace: true }));
  });

  it('keeps the intent for a retry when the sign-in was cancelled', async () => {
    saveCatalogIntent(intent);
    arriveWith('error=oauth_cancelled');

    render(<OAuthCallbackPage />);

    expect(
      await screen.findByText('Sign-in was cancelled before it finished.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument();
    expect(auth.current.setSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(readCatalogIntent()).toEqual(intent);
    expect(window.location.hash).toBe('');
  });

  it('keeps the intent when the state was refused', async () => {
    saveCatalogIntent(intent);
    arriveWith('error=oauth_state_invalid');

    render(<OAuthCallbackPage />);

    expect(await screen.findByText(/started in another browser/)).toBeInTheDocument();
    expect(readCatalogIntent()).toEqual(intent);
  });

  it('keeps the intent when the profile cannot be loaded', async () => {
    saveCatalogIntent(intent);
    getMe.mockRejectedValue(new Error('Session expired'));
    arriveWith('accessToken=access&refreshToken=refresh');

    render(<OAuthCallbackPage />);

    expect(await screen.findByText('Session expired')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(readCatalogIntent()).toEqual(intent);
  });

  it('describes an unknown error code in words', async () => {
    arriveWith('error=oauth_failed');

    render(<OAuthCallbackPage />);

    expect(await screen.findByText('OAuth sign-in failed: oauth failed')).toBeInTheDocument();
  });

  it('signs in once even when StrictMode runs the effect twice', async () => {
    saveCatalogIntent(intent);
    arriveWith('accessToken=access&refreshToken=refresh');

    render(
      <StrictMode>
        <OAuthCallbackPage />
      </StrictMode>,
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/missing oauth tokens/i)).not.toBeInTheDocument();
  });
});
