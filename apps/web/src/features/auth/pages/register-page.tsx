import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { register } from '../api/register';
import { AuthPageLink, AuthPageShell } from '../components/auth-page-shell';
import { RegisterForm } from '../components/register-form';
import { useAuth } from '../hooks/use-auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: Parameters<typeof register>[0]) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const authResponse = await register(values);

      auth.setSession(authResponse);
      appToast.success({
        title: 'Account created',
        description: 'Your dashboard is ready.',
      });
      await navigate({ to: '/dashboard' });
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to create the account right now.');

      setSubmitError(message);
      appToast.error({
        title: 'Registration failed',
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      alternateAction={<AuthPageLink label="Sign in" text="Already have an account?" to="/login" />}
      description="Create your account to keep vehicles, maintenance, reminders, and receipts under your ownership."
      title="Create your account"
    >
      <RegisterForm isSubmitting={isSubmitting} onSubmit={handleSubmit} submitError={submitError} />
    </AuthPageShell>
  );
}
