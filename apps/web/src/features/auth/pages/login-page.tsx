import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { login } from '../api/login';
import { AuthPageLink, AuthPageShell } from '../components/auth-page-shell';
import { LoginForm } from '../components/login-form';
import { OAuthButtons } from '../components/oauth-buttons';
import { useAuth } from '../hooks/use-auth';
import { nextContext } from '../lib/next-context';
import { afterAuthDestination, navigateAfterAuth } from '../lib/return-path';

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { next } = useSearch({ from: '/login' });

  const handleSubmit = async (values: Parameters<typeof login>[0]) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const authResponse = await login(values);

      // Rendered now, so the router's auth context is signed in before the
      // navigation below (see register-page.tsx).
      flushSync(() => auth.setSession(authResponse));
      const destination = afterAuthDestination(next);
      appToast.success({
        title: 'Signed in',
        ...('to' in destination && destination.to === '/home'
          ? { description: 'Taking you to Home.' }
          : {}),
      });
      // Back where they were going, else on to a vehicle picked on a catalog
      // page before signing in, if any.
      await navigateAfterAuth(navigate, destination);
    } catch (error) {
      // One error per failure: under the form, not a toast saying it again.
      setSubmitError(getApiErrorMessage(error, 'Unable to sign in with those credentials.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const context = nextContext(next);

  return (
    <AuthPageShell
      alternateAction={
        <AuthPageLink label="Create a free account" next={next} text="New here?" to="/register" />
      }
      description={context ? `Sign in ${context}.` : undefined}
      title="Sign in"
    >
      <div className="space-y-4">
        <OAuthButtons next={next} />
        <LoginForm isSubmitting={isSubmitting} onSubmit={handleSubmit} submitError={submitError} />
      </div>
    </AuthPageShell>
  );
}
