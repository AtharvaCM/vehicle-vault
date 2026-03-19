import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import type { QueryClient } from '@tanstack/react-query';

import { AppShell } from '@/components/layout/app-shell';

type RouterContext = {
  queryClient: QueryClient;
};

function RootRouteComponent() {
  return (
    <>
      <AppShell>
        <Outlet />
      </AppShell>

      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </>
  );
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootRouteComponent,
});
