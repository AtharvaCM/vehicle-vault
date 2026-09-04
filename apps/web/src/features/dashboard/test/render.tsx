import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';

export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}
