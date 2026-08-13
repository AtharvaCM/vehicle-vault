import * as Sentry from '@sentry/react';

import { getEnv } from '@/lib/env/env';

/**
 * No DSN means no client, and every Sentry call becomes a no-op — error
 * reporting stays off until an environment opts in. GlitchTip speaks the Sentry
 * protocol, so the DSN can point at either backend.
 */
export function initErrorReporting() {
  const { sentryDsn } = getEnv();

  if (!sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Errors only — no tracing, no session replay. Replay in particular would
    // record registration numbers, policy numbers, and document scans.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
