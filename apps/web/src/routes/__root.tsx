import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

import { PageShell } from '@/components/shared/page-shell';

function RootLayout() {
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-slate-100 bg-hero-radial text-slate-900">
      <PageShell className="gap-12">
        <header className="flex items-center justify-between rounded-full border border-white/70 bg-white/75 px-5 py-3 shadow-panel backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Vehicle Vault
            </p>
            <p className="text-sm text-slate-600">Maintenance tracking MVP starter</p>
          </div>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
            Web
          </span>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </PageShell>

      {isDev ? <TanStackRouterDevtools position="bottom-right" /> : null}
      {isDev ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});
