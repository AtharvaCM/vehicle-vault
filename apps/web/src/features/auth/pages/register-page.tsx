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
import { CatalogIntentCard } from '../components/catalog-intent-card';
import { OAuthButtons } from '../components/oauth-buttons';
import { RegisterForm } from '../components/register-form';
import { useAuth } from '../hooks/use-auth';
import { nextContext } from '../lib/next-context';
import { afterAuthDestination, navigateAfterAuth } from '../lib/return-path';

export function RegisterPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { catalog, next } = useSearch({ from: '/register' });

  useKeepCatalogIntent(catalog);

  const handleSubmit = async (values: Parameters<typeof register>[0]) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Came from a catalog page's "Track this vehicle": attribute the sign-up
      // to it, then carry on to that vehicle rather than the dashboard, unless
      // a return path says where they were going.
      const catalogIntent = readCatalogIntent();
      const authResponse = await register({
        ...values,
        ...catalogIntentAttribution(catalogIntent),
      });

      // Rendered now, so the router's auth context is signed in before the
      // navigation below: the add-vehicle form's route checks it, and a stale
      // "signed out" would bounce through /login to the dashboard.
      flushSync(() => auth.setSession(authResponse));
      const destination = afterAuthDestination(next);
      appToast.success({
        title: 'Account created',
        ...('to' in destination
          ? {
              description:
                destination.to === '/vehicles/new'
                  ? 'Add the rest of your vehicle’s details to start tracking it.'
                  : 'Your account is ready.',
            }
          : {}),
      });
      await navigateAfterAuth(navigate, destination);
    } catch (error) {
      // One error per failure: under the form, not a toast saying it again.
      setSubmitError(getApiErrorMessage(error, 'Unable to create the account right now.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Read on every render: the intent is saved from the address in an effect.
  const intent = readCatalogIntent();
  const context = nextContext(next);

  return (
    <AuthPageShell
      alternateAction={
        <AuthPageLink label="Sign in" next={next} text="Already have an account?" to="/login" />
      }
      context={intent ? <CatalogIntentCard intent={intent} /> : null}
      description={context ? `Create your account ${context}.` : undefined}
      title="Create your free account"
    >
      <div className="space-y-4">
        <OAuthButtons next={next} />
        <RegisterForm
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
      </div>
    </AuthPageShell>
  );
}
