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
};
