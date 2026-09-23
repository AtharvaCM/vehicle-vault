import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { afterSignInDestination } from '@/features/catalog-intent/lib/catalog-intent';
import { appToast } from '@/lib/toast';
import { AuthPageShell, AuthPageLink } from '../components/auth-page-shell';
import { verifyEmail } from '../api/verify-email';
import { useAuth } from '../hooks/use-auth';

export function VerifyEmailPage() {
  const { token } = useSearch({ strict: false }) as { token?: string };
  const { isAuthenticated, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // A token works once. StrictMode runs this effect twice in development, and
  // the second attempt would fail and overwrite the first one's success.
  const attemptedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Verification token is missing.');
      return;
    }

    if (attemptedTokenRef.current === token) {
      return;
    }
    attemptedTokenRef.current = token;

    const performVerification = async () => {
      try {
        await verifyEmail({ token });
      } catch (error) {
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to verify your email address.',
        );
        return;
      }

      if (!isAuthenticated) {
        setStatus('success');
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
    };

    void performVerification();
  }, [isAuthenticated, navigate, refreshUser, token]);

  const alternateAction = isAuthenticated ? (
    <p>
      Back to{' '}
      <Link className="font-semibold text-slate-900 hover:text-slate-700" to="/dashboard">
        your garage
      </Link>
    </p>
  ) : (
    <AuthPageLink label="Login" text="Back to" to="/login" />
  );

  if (status === 'loading') {
    return (
      <AuthPageShell
        description="Verifying your email address..."
        title="Verification in progress"
        alternateAction={alternateAction}
      >
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-slate-900" />
          <p className="mt-4 text-sm text-slate-500">This will only take a moment.</p>
        </div>
      </AuthPageShell>
    );
  }

  if (status === 'success') {
    return (
      <AuthPageShell
        description="Your email has been verified. You can now access your garage."
        title="Email Verified!"
        alternateAction={alternateAction}
      >
        <div className="flex flex-col items-center py-4">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 ring-8 ring-green-50/50">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>

          <Link to="/login" className="w-full">
            <Button className="w-full flex h-11 items-center justify-center gap-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
              Continue to Login
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      description={
        isAuthenticated
          ? `${errorMessage || 'The verification link may be invalid or expired.'} You can send yourself a fresh link from the app.`
          : errorMessage || 'The verification link may be invalid or expired.'
      }
      title="Verification Failed"
      alternateAction={alternateAction}
    >
      <div className="flex flex-col items-center py-4">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/50">
          <XCircle className="h-10 w-10 text-red-600" />
        </div>

        <Link to={isAuthenticated ? '/dashboard' : '/login'} className="w-full">
          <Button variant="outline" className="w-full h-11 rounded-xl">
            {isAuthenticated ? 'Back to your garage' : 'Back to Login'}
          </Button>
        </Link>
      </div>
    </AuthPageShell>
  );
}
