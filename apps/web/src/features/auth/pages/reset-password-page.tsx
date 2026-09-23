import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { resetPassword } from '../api/reset-password';
import { AuthPageShell } from '../components/auth-page-shell';
import { PasswordResetForm } from '../components/password-reset-form';

/**
 * Setting a new password from the emailed link. The link's token is read from
 * the address only, never shown or typed. A link with no token, or one the API
 * refuses (expired, already used), replaces the form with a way to ask for a
 * new link, so nobody types a password into a dead form twice.
 */
export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinkSpent, setIsLinkSpent] = useState(false);

  const token = useMemo(() => {
    const searchParams = new URLSearchParams(location.searchStr);

    return searchParams.get('token')?.trim() ?? '';
  }, [location.searchStr]);

  const handleSubmit = async (values: Parameters<typeof resetPassword>[0]) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await resetPassword(values);
      appToast.success({
        title: 'Password updated',
        description: 'Sign in with the new password to continue.',
      });
      await navigate({ to: '/login' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setIsLinkSpent(true);
        return;
      }

      setSubmitError(getApiErrorMessage(error, 'We couldn’t set the new password. Try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const alternateAction = (
    <p>
      Need a new link?{' '}
      <Link className="font-semibold text-slate-900 hover:text-slate-700" to="/forgot-password">
        Request another reset
      </Link>
    </p>
  );

  if (!token || isLinkSpent) {
    return (
      <AuthPageShell
        alternateAction={alternateAction}
        description={
          token
            ? 'Reset links work once, for 30 minutes. Ask for a new one and use the newest email.'
            : 'The link is missing part of its address. Ask for a new one and open it straight from the email.'
        }
        title={
          token ? 'This link has expired or was already used' : 'This reset link is incomplete'
        }
      >
        <Button asChild className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      alternateAction={alternateAction}
      description="Choose a new password for your Vehicle Vault account."
      title="Set a new password"
    >
      <PasswordResetForm
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
        token={token}
      />
    </AuthPageShell>
  );
}
