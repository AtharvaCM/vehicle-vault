import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { appToast } from '@/lib/toast';

import { getMe } from '../api/get-me';
import { useAuth } from '../hooks/use-auth';

/**
 * Reads access/refresh tokens out of the URL fragment that the API
 * callback redirects us to, hydrates the session, fetches the user
 * profile from /auth/me, then bounces to the dashboard.
 *
 * Fragment carries: accessToken, refreshToken, or error (if OAuth flow
 * failed). Fragments stay on the client and are never sent to the
 * server, so they're safe for token transport here.
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const oauthError = params.get('error');
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (oauthError) {
      setError(`OAuth sign-in failed: ${oauthError.replace(/_/g, ' ')}`);
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
          },
        });
        const me = await getMe();
        auth.setSession({ accessToken, refreshToken, user: me });
        window.history.replaceState(null, '', window.location.pathname);
        appToast.success({ title: 'Signed in', description: 'Opening your garage dashboard.' });
        await navigate({ to: '/dashboard' });
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
            <Button onClick={() => navigate({ to: '/login' })} variant="secondary">
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
