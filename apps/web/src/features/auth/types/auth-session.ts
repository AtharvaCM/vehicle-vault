import type { AuthResponse, AuthUser, VerificationEmailOutcome } from '@vehicle-vault/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  /** How the verification mail went at registration; kept with the session so a reload still knows. */
  verificationEmail?: VerificationEmailOutcome;
};

export type AppAuthContextValue = {
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (authResponse: AuthResponse) => void;
  status: AuthStatus;
  user: AuthUser | null;
  /**
   * True when registration could not send the verification mail: the banner,
   * the Home checklist and the wall then lead with Resend instead of claiming
   * a link is in the inbox.
   */
  verificationEmailFailed: boolean;
  /** Forgets a failed send once a resend has gone through. */
  clearVerificationEmailFailure: () => void;
  logout: () => void;
  /**
   * Re-reads the signed-in user from the API and keeps the session's tokens —
   * for when the account changes outside this tab, as verifying an email does.
   * Resolves to null when there is no session or the request fails.
   */
  refreshUser: () => Promise<AuthUser | null>;
};
