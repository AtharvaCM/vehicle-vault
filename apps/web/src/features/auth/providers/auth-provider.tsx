import type { AuthResponse } from '@vehicle-vault/shared';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LoadingState } from '@/components/shared/loading-state';
import { configureApiClient } from '@/lib/api/api-client';
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

  const requestSessionRefresh = useCallback(async () => {
    const currentSession = sessionRef.current;

    if (
      !currentSession?.refreshToken ||
      !hasTokenExpiry(currentSession.refreshToken) ||
      isTokenExpired(currentSession.refreshToken)
    ) {
      return null;
    }

    try {
      return await refreshSession({
        refreshToken: currentSession.refreshToken,
      });
    } catch {
      return null;
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
        const refreshedAuthResponse = await requestSessionRefresh();

        if (!refreshedAuthResponse) {
          return null;
        }

        return persistAuthResponse(refreshedAuthResponse).accessToken;
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
        } catch {
          // Fall through to refresh when the access token is no longer accepted.
        }
      }

      const refreshedAuthResponse = await requestSessionRefresh();

      if (!isActive) {
        return;
      }

      if (!refreshedAuthResponse) {
        clearSession(false, 'bootstrap');
        return;
      }

      persistAuthResponse(refreshedAuthResponse);
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

    expiryTimeoutRef.current = setTimeout(() => {
      void (async () => {
        const refreshedAuthResponse = await requestSessionRefresh();

        if (!refreshedAuthResponse) {
          clearSession(true, 'expired');
          return;
        }

        persistAuthResponse(refreshedAuthResponse);
      })();
    }, refreshDelayMs);

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
      setSession,
      status,
      user: session?.user ?? null,
    }),
    [logout, session?.accessToken, session?.user, setSession, status],
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
