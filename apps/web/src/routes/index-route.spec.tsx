import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { routeTree } from '@/app/router';

/** The app's real route tree at `/`, with only the auth state varying. */
function routerAtRoot(isAuthenticated: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { auth: { isAuthenticated } as never, queryClient },
  });
  return { router, queryClient };
}

describe('the index route', () => {
  it('sends a signed-in visitor straight to the dashboard', async () => {
    const { router } = routerAtRoot(true);

    await router.load().catch(() => undefined);

    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('shows a guest the landing page instead of redirecting to sign-in', async () => {
    const { router, queryClient } = routerAtRoot(false);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: /one record of your vehicle/i }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('points the primary action at registration and the secondary at sign-in', async () => {
    const { router, queryClient } = routerAtRoot(false);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await screen.findByRole('heading', { level: 1 });

    const create = screen.getAllByRole('link', { name: /create free account/i });
    expect(create.length).toBeGreaterThan(0);
    for (const link of create) expect(link).toHaveAttribute('href', '/register');

    const signIn = screen.getAllByRole('link', { name: /^sign in$/i });
    expect(signIn.length).toBeGreaterThan(0);
    for (const link of signIn) expect(link).toHaveAttribute('href', '/login');
  });

  it('describes every screenshot for anyone who cannot see it', async () => {
    const { router, queryClient } = routerAtRoot(false);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await screen.findByRole('heading', { level: 1 });

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(3);
    for (const image of images) expect(image.getAttribute('alt')?.length).toBeGreaterThan(40);
  });
});
