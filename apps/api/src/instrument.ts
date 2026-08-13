import * as Sentry from '@sentry/node';

/**
 * Must be imported before the rest of the app so the SDK can instrument
 * modules as they load — hence a standalone file rather than a call inside
 * bootstrap(). Reads process.env directly for the same reason: Nest's
 * ConfigService does not exist yet at this point.
 *
 * No DSN means no client, and every Sentry call downstream becomes a no-op —
 * so this is inert until an environment opts in. GlitchTip speaks the Sentry
 * protocol, so the DSN can point at either.
 */
const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION,
    // Errors only. GlitchTip's tracing support is partial, and performance data
    // is not what this is for.
    tracesSampleRate: 0,
    // Vehicle data is personal: registration numbers, policy numbers, addresses
    // on documents. Do not let the SDK attach request bodies or user details on
    // its own — anything reported is opted into explicitly.
    sendDefaultPii: false,
  });
}
