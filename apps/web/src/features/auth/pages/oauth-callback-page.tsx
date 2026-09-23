import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { appToast } from '@/lib/toast';

import { getMe } from '../api/get-me';
import { useAuth } from '../hooks/use-auth';
import {
  afterAuthDestination,
  navigateAfterAuth,
  validateReturnPathSearch,
} from '../lib/return-path';

/** What the API's callback reports when it has no tokens to hand over. */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_cancelled: 'Sign-in was cancelled before it finished.',
  oauth_state_invalid:
    'This sign-in expired or was started in another browser. Please start it again.',
};

function describeOAuthError(code: string) {
  return OAUTH_ERROR_MESSAGES[code] ?? `OAuth sign-in failed: ${code.replace(/_/g, ' ')}`;
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
      setError('Missing OAuth tokens in callback URL.');
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
                    : 'Opening your garage dashboard.',
              }
            : {}),
        });
        await navigateAfterAuth(navigate, destination, { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'OAuth login failed.');
      }
    })();
  }, [auth, navigate]);

  if (error) {
    return (
      <PageContainer>
        <ErrorState
          title="Sign-in failed"
          description={error}
          action={
            <Button
              onClick={() => navigate({ to: '/login', search: next ? { next } : {} })}
              variant="secondary"
            >
              Back to sign in
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <LoadingState
        title="Finishing sign in"
        description="Hold tight while we set up your session."
      />
    </PageContainer>
  );
}
