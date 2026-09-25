import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

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

/**
 * The landing page is a lazy route. On a cold CI runner its first import can
 * outlast `findBy`'s default second, leaving only the Suspense fallback on
 * screen; importing it up front means `React.lazy` resolves from the module
 * cache. The longer timeout below is a backstop, not the fix.
 */
const LAZY_PAGE_TIMEOUT = { timeout: 20_000 };

beforeAll(async () => {
  await import('@/features/landing/pages/landing-page');
}, 30_000);

// The first render of the real tree also loads the dev-only devtools; on a cold
// runner that alone has taken over five seconds.
describe('the index route', { timeout: 30_000 }, () => {
  it('sends a signed-in visitor straight to the dashboard', async () => {
    const { router } = routerAtRoot(true);

    await router.load().catch(() => undefined);

    expect(router.state.location.pathname).toBe('/home');
  });

  it('shows a guest the landing page instead of redirecting to sign-in', async () => {
    const { router, queryClient } = routerAtRoot(false);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: /every service, document and renewal/i },
        LAZY_PAGE_TIMEOUT,
      ),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('points every Create free account at registration, with Sign in in the header only', async () => {
    const { router, queryClient } = routerAtRoot(false);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await screen.findByRole('heading', { level: 1 }, LAZY_PAGE_TIMEOUT);

    const create = screen.getAllByRole('link', { name: /create free account/i });
    expect(create.length).toBeGreaterThan(0);
    for (const link of create) expect(link).toHaveAttribute('href', '/register');

    const signIn = screen.getAllByRole('link', { name: /^sign in$/i });
    expect(signIn).toHaveLength(1);
    expect(signIn[0]).toHaveAttribute('href', '/login');
    expect(screen.getByRole('navigation', { name: 'Site' })).toContainElement(signIn[0]!);
  });

  it('describes every screenshot for anyone who cannot see it', async () => {
    const { router, queryClient } = routerAtRoot(false);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await screen.findByRole('heading', { level: 1 }, LAZY_PAGE_TIMEOUT);

    // The feature captures; the hero's Needs attention preview is built, not a picture.
    const images = screen.getAllByRole('img').filter((image) => image.tagName === 'IMG');
    expect(images).toHaveLength(3);
    for (const image of images) expect(image.getAttribute('alt')?.length).toBeGreaterThan(40);
  });
});
