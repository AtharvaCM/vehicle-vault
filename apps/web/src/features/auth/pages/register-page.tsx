import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { flushSync } from 'react-dom';

import { useKeepCatalogIntent } from '@/features/catalog-intent/hooks/use-keep-catalog-intent';
import {
  catalogIntentAttribution,
  readCatalogIntent,
} from '@/features/catalog-intent/lib/catalog-intent';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { register } from '../api/register';
import { AuthPageLink, AuthPageShell } from '../components/auth-page-shell';
import { OAuthButtons } from '../components/oauth-buttons';
import { RegisterForm } from '../components/register-form';
import { useAuth } from '../hooks/use-auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { catalog } = useSearch({ from: '/register' });

  useKeepCatalogIntent(catalog);

  const handleSubmit = async (values: Parameters<typeof register>[0]) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Came from a catalog page's "Track this vehicle": attribute the sign-up
      // to it, then carry on to that vehicle rather than the dashboard.
      const catalogIntent = readCatalogIntent();
      const authResponse = await register({
        ...values,
        ...catalogIntentAttribution(catalogIntent),
      });

      // Rendered now, so the router's auth context is signed in before the
      // navigation below: the add-vehicle form's route checks it, and a stale
      // "signed out" would bounce through /login to the dashboard.
      flushSync(() => auth.setSession(authResponse));
      appToast.success({
        title: 'Account created',
        description: catalogIntent
          ? 'Add the rest of your vehicle’s details to start tracking it.'
          : 'Your dashboard is ready.',
      });
      await navigate({ to: catalogIntent ? '/vehicles/new' : '/dashboard' });
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
      description="Create an account to keep your vehicles, maintenance history, reminders, and receipts in one place."
      title="Create your account"
    >
      <div className="space-y-6">
        <RegisterForm
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
        <OAuthButtons />
      </div>
    </AuthPageShell>
  );
}
