import type { AuthResponse } from '@vehicle-vault/shared';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LoadingState } from '@/components/shared/loading-state';
import { configureApiClient } from '@/lib/api/api-client';
import { queryClient } from '@/lib/query/query-client';

import { getMe } from '../api/get-me';
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  setStoredAuthSession,
} from '../lib/auth-session-storage';
import {
  getAccessTokenExpiryEpochMs,
  hasAccessTokenExpiry,
  isAccessTokenExpired,
} from '../lib/auth-token';
import type { AppAuthContextValue, AuthSession, AuthStatus } from '../types/auth-session';
import { appToast } from '@/lib/toast';

type AuthProviderProps = {
  children: React.ReactNode;
};

export const AuthContext = createContext<AppAuthContextValue | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const initialSessionRef = useRef<AuthSession | null>(getStoredAuthSession());
  const expiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [session, setSessionState] = useState<AuthSession | null>(initialSessionRef.current);
  const [status, setStatus] = useState<AuthStatus>(
    initialSessionRef.current?.accessToken ? 'loading' : 'anonymous',
  );

  const clearExpiryTimeout = useCallback(() => {
    if (expiryTimeoutRef.current) {
      clearTimeout(expiryTimeoutRef.current);
      expiryTimeoutRef.current = null;
    }
  }, []);

  const clearSession = useCallback((
    shouldRedirectToLogin: boolean,
    reason: 'manual' | 'expired' | 'unauthorized' | 'bootstrap' = 'manual',
  ) => {
    clearExpiryTimeout();
    clearStoredAuthSession();
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
  }, [clearExpiryTimeout]);

  const setSession = useCallback((authResponse: AuthResponse) => {
    const nextSession = {
      accessToken: authResponse.accessToken,
      user: authResponse.user,
    } satisfies AuthSession;

    setStoredAuthSession(nextSession);
    setSessionState(nextSession);
    setStatus('authenticated');
    queryClient.clear();
  }, []);

  const logout = useCallback(() => {
    clearSession(false, 'manual');
  }, [clearSession]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => session?.accessToken ?? null,
      onUnauthorized: () => clearSession(true, 'unauthorized'),
    });
  }, [clearSession, session?.accessToken]);

  useEffect(() => {
    const storedSession = initialSessionRef.current;

    if (!storedSession?.accessToken) {
      return;
    }

    if (
      !hasAccessTokenExpiry(storedSession.accessToken) ||
      isAccessTokenExpired(storedSession.accessToken)
    ) {
      clearSession(false, 'bootstrap');
      return;
    }

    let isActive = true;

    void getMe()
      .then((user) => {
        if (!isActive) {
          return;
        }

        const refreshedSession = {
          accessToken: storedSession.accessToken,
          user,
        } satisfies AuthSession;

        setStoredAuthSession(refreshedSession);
        setSessionState(refreshedSession);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        clearSession(false, 'bootstrap');
      });

    return () => {
      isActive = false;
    };
  }, [clearSession]);

  useEffect(() => {
    clearExpiryTimeout();

    if (!session?.accessToken || status !== 'authenticated') {
      return;
    }

    const expiryEpochMs = getAccessTokenExpiryEpochMs(session.accessToken);

    if (!expiryEpochMs) {
      clearSession(true, 'expired');
      return;
    }

    const remainingMs = expiryEpochMs - Date.now();

    if (remainingMs <= 0) {
      clearSession(true, 'expired');
      return;
    }

    expiryTimeoutRef.current = setTimeout(() => {
      clearSession(true, 'expired');
    }, remainingMs);

    return clearExpiryTimeout;
  }, [clearExpiryTimeout, clearSession, session?.accessToken, status]);

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
            description="Restoring your account session before opening the workspace."
            title="Loading account"
          />
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
