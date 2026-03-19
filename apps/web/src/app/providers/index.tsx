import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';

import { router } from '@/app/router';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { AuthProvider } from '@/features/auth/providers/auth-provider';
import { queryClient } from '@/lib/query/query-client';

function AppRouterProvider() {
  const auth = useAuth();

  return <RouterProvider context={{ auth, queryClient }} router={router} />;
}

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouterProvider />
      </AuthProvider>
    </QueryClientProvider>
  );
}
