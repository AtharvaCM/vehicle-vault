import type { AuthResponse } from '@vehicle-vault/shared';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LoadingState } from '@/components/shared/loading-state';
import { configureApiClient } from '@/lib/api/api-client';
import { ApiError } from '@/lib/api/api-error';
import { queryClient } from '@/lib/query/query-client';
import { appToast } from '@/lib/toast';

import { getMe } from '../api/get-me';
import { logout as revokeSession } from '../api/logout';
import { refreshSession } from '../api/refresh-session';
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession,
} from '../lib/auth-session-storage';
import { getTokenExpiryEpochMs, hasTokenExpiry, isTokenExpired } from '../lib/auth-token';
import type { AppAuthContextValue, AuthSession, AuthStatus } from '../types/auth-session';

type AuthProviderProps = {
  children: React.ReactNode;
};

type ClearSessionReason = 'manual' | 'expired' | 'unauthorized' | 'bootstrap';

type PersistSessionOptions = {
  clearQueries?: boolean;
};

const ACCESS_TOKEN_REFRESH_LEAD_MS = 60_000;

/** How long to wait before asking again when the API could not be reached. */
const UNREACHABLE_RETRY_MS = 30_000;

/**
 * What asking for a fresh session came to. Only the server saying no ends a
 * session. Not reaching it (offline, which the precached app now opens into, or
 * the API down) keeps the session, so opening the app with no signal does not
 * sign anyone out.
 */
type RefreshOutcome =
  | { kind: 'refreshed'; response: AuthResponse }
  | { kind: 'rejected' }
  | { kind: 'unreachable' };

/** The server answered and refused the session, as opposed to not answering. */
function isSessionRejection(error: unknown): boolean {
  return error instanceof ApiError && [400, 401, 403].includes(error.status);
}

export const AuthContext = createContext<AppAuthContextValue | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const initialSessionRef = useRef<AuthSession | null>(getStoredAuthSession());
  const sessionRef = useRef<AuthSession | null>(initialSessionRef.current);
  const expiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [session, setSessionState] = useState<AuthSession | null>(initialSessionRef.current);
  const [status, setStatus] = useState<AuthStatus>(
    initialSessionRef.current?.refreshToken ? 'loading' : 'anonymous',
  );

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearExpiryTimeout = useCallback(() => {
    if (expiryTimeoutRef.current) {
      clearTimeout(expiryTimeoutRef.current);
      expiryTimeoutRef.current = null;
    }
  }, []);

  const clearSession = useCallback(
    (shouldRedirectToLogin: boolean, reason: ClearSessionReason = 'manual') => {
      clearExpiryTimeout();
      clearStoredAuthSession();
      sessionRef.current = null;
      setSessionState(null);
      setStatus('anonymous');
      queryClient.clear();

      if (reason === 'expired' || reason === 'unauthorized') {
        appToast.info({
          title: 'Session expired',
          description: 'Sign in again to continue working in Vehicle Vault.',
        });
      }

      if (
        shouldRedirectToLogin &&
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/register'
      ) {
        window.location.replace('/login');
      }
    },
    [clearExpiryTimeout],
  );

  const persistSession = useCallback(
    (nextSession: AuthSession, options?: PersistSessionOptions) => {
      setStoredAuthSession(nextSession);
      sessionRef.current = nextSession;
      setSessionState(nextSession);
      setStatus('authenticated');

      if (options?.clearQueries) {
        queryClient.clear();
      }

      return nextSession;
    },
    [],
  );

  const persistAuthResponse = useCallback(
    (authResponse: AuthResponse, options?: PersistSessionOptions) => {
      return persistSession(
        {
          accessToken: authResponse.accessToken,
          refreshToken: authResponse.refreshToken,
          user: authResponse.user,
        },
        options,
      );
    },
    [persistSession],
  );

  const requestSessionRefresh = useCallback(async (): Promise<RefreshOutcome> => {
    const currentSession = sessionRef.current;

    if (
      !currentSession?.refreshToken ||
      !hasTokenExpiry(currentSession.refreshToken) ||
      isTokenExpired(currentSession.refreshToken)
    ) {
      return { kind: 'rejected' };
    }

    try {
      const response = await refreshSession({
        refreshToken: currentSession.refreshToken,
      });
      return { kind: 'refreshed', response };
    } catch (error) {
      return isSessionRejection(error) ? { kind: 'rejected' } : { kind: 'unreachable' };
    }
  }, []);

  const setSession = useCallback(
    (authResponse: AuthResponse) => {
      persistAuthResponse(authResponse, {
        clearQueries: true,
      });
    },
    [persistAuthResponse],
  );

  const refreshUser = useCallback(async () => {
    const requestedFor = sessionRef.current?.user.id;

    if (!requestedFor) {
      return null;
    }

    try {
      const user = await getMe();
      const current = sessionRef.current;

      // Signed out, or into another account, while the request was out.
      if (!current || current.user.id !== requestedFor || user.id !== requestedFor) {
        return null;
      }

      persistSession({ ...current, user });
      return user;
    } catch {
      return null;
    }
  }, [persistSession]);

  const logout = useCallback(() => {
    const refreshToken = sessionRef.current?.refreshToken;

    if (refreshToken) {
      void revokeSession({ refreshToken }).catch(() => undefined);
    }

    clearSession(false, 'manual');
  }, [clearSession]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      refreshAccessToken: async () => {
        const outcome = await requestSessionRefresh();

        if (outcome.kind === 'unreachable') {
          // Fails this one request without signing out: the api client only
          // reaches onUnauthorized when a refresh comes back empty.
          throw new Error('Could not reach Vehicle Vault to refresh the session.');
        }
        if (outcome.kind === 'rejected') {
          return null;
        }

        return persistAuthResponse(outcome.response).accessToken;
      },
      onUnauthorized: () => clearSession(true, 'unauthorized'),
    });
  }, [clearSession, persistAuthResponse, requestSessionRefresh]);

  useEffect(() => {
    const storedSession = initialSessionRef.current;

    if (!storedSession?.refreshToken) {
      return;
    }

    let isActive = true;

    const restoreSession = async () => {
      const hasReusableAccessToken =
        Boolean(storedSession.accessToken) &&
        hasTokenExpiry(storedSession.accessToken) &&
        !isTokenExpired(storedSession.accessToken);

      if (hasReusableAccessToken) {
        try {
          const user = await getMe();

          if (!isActive) {
            return;
          }

          persistSession({
            ...storedSession,
            user,
          });
          return;
        } catch (error) {
          // Unreachable, not refused: open with the session as it was stored.
          if (!isSessionRejection(error)) {
            if (isActive) persistSession(storedSession);
            return;
          }
          // Refused: fall through to a refresh.
        }
      }

      const outcome = await requestSessionRefresh();

      if (!isActive) {
        return;
      }

      if (outcome.kind === 'rejected') {
        clearSession(false, 'bootstrap');
        return;
      }
      if (outcome.kind === 'unreachable') {
        // The expiry timer keeps trying, and a request made once the API is
        // back refreshes through the api client.
        persistSession(storedSession);
        return;
      }

      persistAuthResponse(outcome.response);
    };

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, [clearSession, persistAuthResponse, persistSession, requestSessionRefresh]);

  useEffect(() => {
    clearExpiryTimeout();

    if (!session?.accessToken || status !== 'authenticated') {
      return;
    }

    const expiryEpochMs = getTokenExpiryEpochMs(session.accessToken);

    if (!expiryEpochMs) {
      clearSession(true, 'expired');
      return;
    }

    const refreshDelayMs = Math.max(expiryEpochMs - Date.now() - ACCESS_TOKEN_REFRESH_LEAD_MS, 0);

    const refreshBeforeExpiry = async () => {
      const outcome = await requestSessionRefresh();

      if (outcome.kind === 'rejected') {
        clearSession(true, 'expired');
        return;
      }
      if (outcome.kind === 'unreachable') {
        expiryTimeoutRef.current = setTimeout(
          () => void refreshBeforeExpiry(),
          UNREACHABLE_RETRY_MS,
        );
        return;
      }

      persistAuthResponse(outcome.response);
    };

    expiryTimeoutRef.current = setTimeout(() => void refreshBeforeExpiry(), refreshDelayMs);

    return clearExpiryTimeout;
  }, [
    clearExpiryTimeout,
    clearSession,
    persistAuthResponse,
    requestSessionRefresh,
    session?.accessToken,
    status,
  ]);

  const value = useMemo<AppAuthContextValue>(
    () => ({
      accessToken: session?.accessToken ?? null,
      isAuthenticated: status === 'authenticated' && Boolean(session?.accessToken),
      logout,
      refreshUser,
      setSession,
      status,
      user: session?.user ?? null,
    }),
    [logout, refreshUser, session?.accessToken, session?.user, setSession, status],
  );

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md">
          <LoadingState
            description="Restoring your account so you can get back to your garage."
            title="Loading account"
          />
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
