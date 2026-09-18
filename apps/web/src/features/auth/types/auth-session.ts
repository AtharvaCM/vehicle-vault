import type { AuthResponse, AuthUser } from '@vehicle-vault/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type AppAuthContextValue = {
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (authResponse: AuthResponse) => void;
  status: AuthStatus;
  user: AuthUser | null;
  logout: () => void;
  /**
   * Re-reads the signed-in user from the API and keeps the session's tokens —
   * for when the account changes outside this tab, as verifying an email does.
   * Resolves to null when there is no session or the request fails.
   */
  refreshUser: () => Promise<AuthUser | null>;
};
