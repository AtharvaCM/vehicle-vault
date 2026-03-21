import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { resetPassword } from '../api/reset-password';
import { AuthPageShell } from '../components/auth-page-shell';
import { PasswordResetForm } from '../components/password-reset-form';

export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialToken = useMemo(() => {
    const searchParams = new URLSearchParams(location.searchStr);

    return searchParams.get('token') ?? '';
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
      const message = getApiErrorMessage(error, 'Unable to reset the password with that token.');

      setSubmitError(message);
      appToast.error({
        title: 'Password reset failed',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      alternateAction={
        <p>
          Need a new token?{' '}
          <Link className="font-semibold text-slate-900 hover:text-slate-700" to="/forgot-password">
            Request another reset
          </Link>
        </p>
      }
      description="Choose a new password using the one-time reset token you requested."
      title="Set a new password"
    >
      <PasswordResetForm
        initialToken={initialToken}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        submitError={submitError}
      />
    </AuthPageShell>
  );
}
