import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { hydrate as hydrateQueries, type QueryClient } from '@tanstack/react-query';
import { hydrate as hydrateRouter } from '@tanstack/react-router/ssr/client';

import type { router as appRouter } from '@/app/router';
import { getStoredAuthSession } from '@/features/auth/lib/auth-session-storage';

import { takePrerenderedState } from './prerendered-state';

type MountOptions = {
  router: typeof appRouter;
  queryClient: QueryClient;
};

/**
 * Starts the app in `rootElement`. On a prerendered page it hydrates over the
 * markup already there, with the query cache and route matches the page was
 * rendered with, so the content never blanks or flashes a loading state.
 * Everywhere else it is the ordinary client render.
 */
export function mountApp(rootElement: HTMLElement, app: ReactNode, options: MountOptions) {
  const state = takePrerenderedState();
  if (state) {
    // Either way the page's data is already here; no need to fetch it again.
    hydrateQueries(options.queryClient, state);
  }

  // The prerendered markup is the signed-out page. With a stored session the
  // auth provider first shows "Loading account" while it checks the session,
  // which that markup cannot match, so a returning user gets the ordinary
  // client render (as before prerendering) instead of a hydration mismatch.
  if (!state || getStoredAuthSession()?.refreshToken) {
    ReactDOM.createRoot(rootElement).render(app);
    return;
  }

  hydrateRouter(options.router).then(
    () => {
      ReactDOM.hydrateRoot(rootElement, app);
    },
    (error: unknown) => {
      console.error('Could not hydrate the prerendered page; rendering it afresh.', error);
      ReactDOM.createRoot(rootElement).render(app);
    },
  );
}
