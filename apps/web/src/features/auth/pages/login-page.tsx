import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { login } from '../api/login';
import { AuthPageLink, AuthPageShell } from '../components/auth-page-shell';
import { LoginForm } from '../components/login-form';
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

      auth.setSession(authResponse);
      appToast.success({
        title: 'Signed in',
        description: 'Opening your garage dashboard.',
      });
      await navigate({ to: '/dashboard' });
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
      description="Sign in to access your vehicles, maintenance history, reminders, and receipts."
      title="Welcome back"
    >
      <LoginForm isSubmitting={isSubmitting} onSubmit={handleSubmit} submitError={submitError} />
    </AuthPageShell>
  );
}
