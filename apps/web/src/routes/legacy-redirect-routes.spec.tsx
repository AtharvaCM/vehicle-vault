import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { routeTree } from '@/app/router';

/** The app's real route tree at `href`, loaded the way a first visit loads it. */
async function land(href: string, isAuthenticated = true) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [href] }),
    context: { auth: { isAuthenticated } as never, queryClient: new QueryClient() },
  });
  await router.load().catch(() => undefined);
  const { pathname, search, hash } = router.state.location;
  return { pathname, search, hash, history: router.history };
}

// The first load of the real tree also pulls in the dev-only devtools; on a cold
// runner that alone has taken over five seconds (see index-route.spec.tsx).
describe('old top-level addresses', { timeout: 30_000 }, () => {
  it('forwards /dashboard to Home, keeping the attention filter', async () => {
    expect(await land('/dashboard?focus=overdue')).toMatchObject({
      pathname: '/home',
      search: { focus: 'overdue' },
    });
  });

  it('forwards /vehicles to the Garage, keeping the list filters', async () => {
    expect(await land('/vehicles?search=creta&sort=year-desc')).toMatchObject({
      pathname: '/garage',
      search: { search: 'creta', sort: 'year-desc' },
    });
  });

  it('forwards /reminders to Upcoming, keeping the status filter', async () => {
    expect(await land('/reminders?status=overdue')).toMatchObject({
      pathname: '/upcoming',
      search: { status: 'overdue' },
    });
  });

  it('forwards /maintenance to History, keeping the search and sort', async () => {
    expect(await land('/maintenance?search=oil&sort=cost-desc')).toMatchObject({
      pathname: '/history',
      search: { search: 'oil', sort: 'cost-desc' },
    });
  });

  it('forwards /loans to Costs', async () => {
    expect(await land('/loans')).toMatchObject({ pathname: '/costs' });
  });

  it('keeps the hash, as the dashboard garage link uses one', async () => {
    expect(await land('/dashboard#garage')).toMatchObject({ pathname: '/home', hash: 'garage' });
  });

  it('replaces the old entry, so Back does not bounce through the redirect', async () => {
    const { history } = await land('/vehicles');
    expect(history.length).toBe(1);
  });

  it('leaves the vehicle pages under /vehicles where they are', async () => {
    expect((await land('/vehicles/new')).pathname).toBe('/vehicles/new');
    expect((await land('/vehicles/abc123')).pathname).toBe('/vehicles/abc123');
    expect((await land('/reminders/abc123')).pathname).toBe('/reminders/abc123');
  });

  it('sends a signed-out visitor to sign-in with the new address to come back to', async () => {
    expect(await land('/reminders?status=overdue', false)).toMatchObject({
      pathname: '/login',
      search: { next: '/upcoming?status=overdue' },
    });
  });
});
