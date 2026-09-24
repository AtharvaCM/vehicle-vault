import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';

import { router as appRouter } from '@/app/router';
import { AppErrorBoundary } from '@/components/errors/app-error-boundary';
import { ConfirmHost } from '@/components/shared/confirm';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { AuthProvider } from '@/features/auth/providers/auth-provider';
import { queryClient as appQueryClient } from '@/lib/query/query-client';

type AppProvidersProps = {
  /**
   * The browser app uses the module-level router and query client. The
   * build-time prerender passes its own, one per page, so it renders this same
   * tree — which is what lets the browser hydrate over it.
   */
  router?: typeof appRouter;
  queryClient?: QueryClient;
};

function AppRouterProvider({ router, queryClient }: Required<AppProvidersProps>) {
  const auth = useAuth();

  return <RouterProvider context={{ auth, queryClient }} router={router} />;
}

export function AppProviders({
  router = appRouter,
  queryClient = appQueryClient,
}: AppProvidersProps = {}) {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={120}>
          <AuthProvider>
            <AppRouterProvider queryClient={queryClient} router={router} />
            <Toaster />
            <ConfirmHost />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
