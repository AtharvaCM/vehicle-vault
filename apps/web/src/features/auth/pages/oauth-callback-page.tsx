import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { appToast } from '@/lib/toast';

import { getMe } from '../api/get-me';
import { AuthPageLink, AuthPageShell } from '../components/auth-page-shell';
import { OAuthButtons } from '../components/oauth-buttons';
import { useAuth } from '../hooks/use-auth';
import {
  afterAuthDestination,
  navigateAfterAuth,
  validateReturnPathSearch,
} from '../lib/return-path';

/**
 * What the API's callback, or Google itself, reports when there are no tokens
 * to hand over, in the words a person would use (#365). `access_denied` is
 * Google's word for "you pressed Cancel".
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You cancelled signing in with Google.',
  oauth_cancelled: 'You cancelled signing in with Google.',
  oauth_state_invalid:
    'This sign-in expired, or it was started in another browser. Start it again here.',
};

const GENERIC_OAUTH_ERROR = 'Signing in with Google didn’t finish. Try again, or use your email.';

export function describeOAuthError(code: string) {
  return OAUTH_ERROR_MESSAGES[code] ?? GENERIC_OAUTH_ERROR;
}

/**
 * Reads access/refresh tokens out of the URL fragment that the API
 * callback redirects us to, hydrates the session, fetches the user
 * profile from /auth/me, then moves on: to the return path the sign-in
 * began with (`next`, where the route guard was taking the visitor), else to
 * the add-vehicle form while a catalog intent is waiting ("Track this
 * vehicle" before signing in), else to the dashboard.
 *
 * Fragment carries: accessToken, refreshToken, or error (if OAuth flow
 * failed), and `next` when the sign-in began with one. Fragments stay on the client and are never sent to the
 * server, so they're safe for token transport here.
 *
 * The catalog intent is only read here, never cleared: the add-vehicle form
 * uses it up, and a failed or cancelled sign-in leaves it for the next try.
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<string | undefined>(undefined);
  // The fragment is read once: setting the session changes `auth`, and the
  // tokens are gone from the address by the time the effect could run again.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const oauthError = params.get('error');
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const returnPath = validateReturnPathSearch({ next: params.get('next') }).next;
    setNext(returnPath);

    // Tokens and error codes stay out of history and out of a copied address.
    window.history.replaceState(null, '', window.location.pathname);

    if (oauthError) {
      setError(describeOAuthError(oauthError));
      return;
    }
    if (!accessToken || !refreshToken) {
      setError(GENERIC_OAUTH_ERROR);
      return;
    }

    void (async () => {
      try {
        // Temporarily seed the session with a placeholder user so the
        // api-client picks up the access token, then refresh from /auth/me.
        auth.setSession({
          accessToken,
          refreshToken,
          user: {
            id: '',
            name: '',
            email: '',
            role: 'user',
            emailVerified: true,
            allowedCatalogSources: [],
            emailVerificationDueAt: null,
          },
        });
        const me = await getMe();
        // Rendered now, so the router's auth context holds the real user
        // before the navigation below (see register-page.tsx).
        flushSync(() => auth.setSession({ accessToken, refreshToken, user: me }));

        const destination = afterAuthDestination(returnPath);
        appToast.success({
          title: 'Signed in',
          ...('to' in destination
            ? {
                description:
                  destination.to === '/vehicles/new'
                    ? 'Add the rest of your vehicle’s details to start tracking it.'
                    : 'Taking you to Home.',
              }
            : {}),
        });
        await navigateAfterAuth(navigate, destination, { replace: true });
      } catch {
        setError(GENERIC_OAUTH_ERROR);
      }
    })();
  }, [auth, navigate]);

  if (error) {
    // In the auth card, with the same two ways in as the sign-in page: Google
    // again, or email (#365).
    return (
      <AuthPageShell
        alternateAction={
          <AuthPageLink label="Create a free account" next={next} text="New here?" to="/register" />
        }
        description={error}
        title="Sign-in didn’t finish"
      >
        <div className="space-y-4" data-testid="oauth-callback-error">
          <OAuthButtons dividerLabel="or" next={next} />
          <Button asChild className="w-full" variant="outline">
            <Link search={next ? { next } : {}} to="/login">
              Sign in with email
            </Link>
          </Button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell alternateAction={null} title="Finishing sign in">
      <LoadingState description="Setting up your session." title="Signing you in" />
    </AuthPageShell>
  );
}
