import * as Sentry from '@sentry/react';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useEffect } from 'react';

import { RecoveryScreen } from './recovery-screen';

/**
 * The router's default error component, for anything a route throws while
 * loading or rendering.
 *
 * Reports explicitly: the router catches these itself, so no outer boundary
 * ever sees them. `captureException` is a no-op until `initErrorReporting`
 * has a DSN. The router resets this boundary on every navigation, so the
 * screen clears as soon as the user goes somewhere else — including through
 * the sidebar, which stays usable because the error renders inside the shell.
 */
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return <RecoveryScreen onGoToDashboard={() => void router.navigate({ to: '/dashboard' })} />;
}
