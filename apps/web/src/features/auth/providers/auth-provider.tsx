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
import type { AppAuthContextValue, AuthSession, AuthStatus } from '../types/auth-session';

type AuthProviderProps = {
  children: React.ReactNode;
};

export const AuthContext = createContext<AppAuthContextValue | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const initialSessionRef = useRef<AuthSession | null>(getStoredAuthSession());
  const [session, setSessionState] = useState<AuthSession | null>(initialSessionRef.current);
  const [status, setStatus] = useState<AuthStatus>(
    initialSessionRef.current?.accessToken ? 'loading' : 'anonymous',
  );

  const clearSession = useCallback((shouldRedirectToLogin: boolean) => {
    clearStoredAuthSession();
    setSessionState(null);
    setStatus('anonymous');
    queryClient.clear();

    if (
      shouldRedirectToLogin &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login' &&
      window.location.pathname !== '/register'
    ) {
      window.location.replace('/login');
    }
  }, []);

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
    clearSession(false);
  }, [clearSession]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => session?.accessToken ?? null,
      onUnauthorized: () => clearSession(true),
    });
  }, [clearSession, session?.accessToken]);

  useEffect(() => {
    const storedSession = initialSessionRef.current;

    if (!storedSession?.accessToken) {
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

        clearSession(false);
      });

    return () => {
      isActive = false;
    };
  }, [clearSession]);

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
