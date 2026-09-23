import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import { afterSignInDestination } from '@/features/catalog-intent/lib/catalog-intent';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { login } from '../api/login';
import { AuthPageLink, AuthPageShell } from '../components/auth-page-shell';
import { LoginForm } from '../components/login-form';
import { OAuthButtons } from '../components/oauth-buttons';
import { useAuth } from '../hooks/use-auth';

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: Parameters<typeof login>[0]) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const authResponse = await login(values);

      // Rendered now, so the router's auth context is signed in before the
      // navigation below (see register-page.tsx).
      flushSync(() => auth.setSession(authResponse));
      appToast.success({
        title: 'Signed in',
        description: 'Opening your garage dashboard.',
      });
      // On to a vehicle picked on a catalog page before signing in, if any.
      await navigate({ to: afterSignInDestination() });
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to sign in with those credentials.');

      setSubmitError(message);
      appToast.error({
        title: 'Sign-in failed',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      alternateAction={<AuthPageLink label="Create one" text="Need an account?" to="/register" />}
      description="Sign in to see your garage, service history, reminders, and receipts."
      title="Welcome back"
    >
      <div className="space-y-6">
        <LoginForm isSubmitting={isSubmitting} onSubmit={handleSubmit} submitError={submitError} />
        <OAuthButtons />
      </div>
    </AuthPageShell>
  );
}
