import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { afterSignInDestination } from '@/features/catalog-intent/lib/catalog-intent';
import { ApiError } from '@/lib/api/api-error';
import { appToast } from '@/lib/toast';
import { AuthPageShell, AuthPageLink } from '../components/auth-page-shell';
import { verifyEmail } from '../api/verify-email';
import { useAuth } from '../hooks/use-auth';
import { useResendVerification } from '../hooks/use-resend-verification';

/**
 * Where a verification link ends up:
 * - `verified`: this link verified the address (signed out; a signed-in visit
 *   goes straight back into the app instead);
 * - `already`: the signed-in account is verified already, so an old link is
 *   not even tried;
 * - `spent`: the API refused the link (expired, used, or never issued);
 * - `missing`: the address carried no link token at all;
 * - `failed`: anything else (offline, a server error), which is worth retrying.
 *
 * None of them touch the session: `verifyEmail` skips the unauthorized
 * handler, so a refused link never signs anybody out.
 */
type VerifyState = 'loading' | 'verified' | 'already' | 'spent' | 'missing' | 'failed';

export function VerifyEmailPage() {
  const { token } = useSearch({ strict: false }) as { token?: string };
  const { isAuthenticated, refreshUser, user } = useAuth();
  const navigate = useNavigate();
  const alreadyVerified = isAuthenticated && user?.emailVerified === true;
  const [state, setState] = useState<VerifyState>(() => {
    if (alreadyVerified) return 'already';
    return token ? 'loading' : 'missing';
  });
  const { resend, isResending, hasSent, isUnavailable } = useResendVerification(
    isAuthenticated && !alreadyVerified ? user?.email : undefined,
  );
  // A token works once. StrictMode runs this effect twice in development, and
  // the second attempt would fail and overwrite the first one's success.
  const attemptedTokenRef = useRef<string | null>(null);

  const performVerification = useCallback(
    async (linkToken: string) => {
      setState('loading');

      try {
        await verifyEmail({ token: linkToken });
      } catch (error) {
        setState(error instanceof ApiError && error.status === 401 ? 'spent' : 'failed');
        return;
      }

      if (!isAuthenticated) {
        setState('verified');
        return;
      }

      // Already signed in, usually in the tab this link opened: pick up the
      // verified account and carry on in the app instead of signing in again.
      await refreshUser();
      appToast.success({
        title: 'Email verified',
        description: 'Your account is all set.',
      });
      // Or on to the vehicle a catalog page's "Track this vehicle" was for,
      // when the add-vehicle form has not used that intent yet.
      await navigate({ to: afterSignInDestination(), replace: true });
    },
    [isAuthenticated, navigate, refreshUser],
  );

  useEffect(() => {
    if (!token || alreadyVerified || attemptedTokenRef.current === token) {
      return;
    }
    attemptedTokenRef.current = token;

    void performVerification(token);
  }, [alreadyVerified, performVerification, token]);

  const alternateAction = isAuthenticated ? (
    <p>
      Back to{' '}
      <Link className="font-semibold text-fg hover:text-fg-2" to="/dashboard">
        your garage
      </Link>
    </p>
  ) : (
    <AuthPageLink label="Sign in" text="Back to" to="/login" />
  );

  if (state === 'loading') {
    return (
      <AuthPageShell
        description="Verifying your email address..."
        title="Verification in progress"
        alternateAction={alternateAction}
      >
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-fg" />
          <p className="mt-4 text-sm text-fg-3">This will only take a moment.</p>
        </div>
      </AuthPageShell>
    );
  }

  if (state === 'verified' || state === 'already') {
    return (
      <AuthPageShell
        description={
          state === 'already'
            ? 'Your email is already verified. There is nothing more to do.'
            : 'Your email has been verified. You can now access your garage.'
        }
        title={state === 'already' ? 'Already verified' : 'Email verified'}
        alternateAction={alternateAction}
      >
        <div className="flex flex-col items-center py-4">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-ok-tint ring-8 ring-ok-tint/50">
            <CheckCircle2 className="h-10 w-10 text-ok" />
          </div>

          <Button
            asChild
            className="w-full flex h-11 items-center justify-center gap-2 rounded-xl transition-colors"
          >
            {isAuthenticated ? (
              <Link to="/dashboard">
                Continue to your garage
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link to="/login">
                Continue to sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </Button>
        </div>
      </AuthPageShell>
    );
  }

  const failure = describeFailure(state, isAuthenticated);
  const canResend = isAuthenticated && !alreadyVerified && state !== 'failed';

  return (
    <AuthPageShell
      description={failure.description}
      title={failure.title}
      alternateAction={alternateAction}
    >
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-late-tint ring-8 ring-late-tint/50">
          <XCircle className="h-10 w-10 text-late" />
        </div>

        {state === 'failed' && token ? (
          <Button
            className="w-full h-11 rounded-xl"
            onClick={() => void performVerification(token)}
          >
            Try again
          </Button>
        ) : null}

        {canResend ? (
          <Button
            className="w-full h-11 rounded-xl"
            disabled={isResending || hasSent || isUnavailable}
            onClick={() => void resend()}
          >
            {isUnavailable
              ? 'Email isn’t available yet'
              : hasSent
                ? 'New link sent'
                : isResending
                  ? 'Sending…'
                  : 'Send a new link'}
          </Button>
        ) : null}

        <Button asChild className="w-full h-11 rounded-xl" variant="outline">
          {isAuthenticated ? (
            <Link to="/dashboard">Continue to your garage</Link>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
        </Button>
      </div>
    </AuthPageShell>
  );
}

function describeFailure(state: 'spent' | 'missing' | 'failed', isAuthenticated: boolean) {
  if (state === 'failed') {
    return {
      title: 'We couldn’t verify your email',
      description: 'Something went wrong on our side or with the connection. Try again.',
    };
  }

  const next = isAuthenticated
    ? 'Send yourself a new link, or carry on in the app for now.'
    : 'If you already verified, just sign in. Otherwise sign in and send yourself a new link.';

  return state === 'missing'
    ? { title: 'This verification link is incomplete', description: next }
    : { title: 'This link has expired or was already used', description: next };
}
