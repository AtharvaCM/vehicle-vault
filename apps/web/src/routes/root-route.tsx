import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import type { QueryClient } from '@tanstack/react-query';

import type { AppAuthContextValue } from '@/features/auth/types/auth-session';

type RouterContext = {
  auth: AppAuthContextValue;
  queryClient: QueryClient;
};

/**
 * Devtools are for a person at a dev server. Under automation they are left
 * out: their floating toggles sit over the bottom navigation bar at phone
 * widths, where Playwright would have to click through them.
 */
const showDevtools = import.meta.env.DEV && !globalThis.navigator?.webdriver;

function RootRouteComponent() {
  return (
    <>
      <Outlet />

      {showDevtools ? <TanStackRouterDevtools position="bottom-right" /> : null}
      {showDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </>
  );
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootRouteComponent,
});
