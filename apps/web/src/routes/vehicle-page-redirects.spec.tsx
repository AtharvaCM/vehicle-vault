import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { routeTree } from '@/app/router';

/** The app's real route tree at `href`, loaded the way a first visit loads it. */
async function land(href: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [href] }),
    context: { auth: { isAuthenticated: true } as never, queryClient: new QueryClient() },
  });
  await router.load().catch(() => undefined);
  const { pathname, search } = router.state.location;
  return { pathname, search, history: router.history };
}

// The first load of the real tree also pulls in the dev-only devtools, which
// has taken over five seconds on a cold runner (see index-route.spec.tsx).
describe('addresses that moved into the vehicle page', { timeout: 30_000 }, () => {
  it("forwards a vehicle's service list to its History tab", async () => {
    expect(await land('/vehicles/abc123/maintenance')).toMatchObject({
      pathname: '/vehicles/abc123',
      search: { tab: 'history' },
    });
  });

  it("forwards a vehicle's reminder list to its Reminders tab", async () => {
    expect(await land('/vehicles/abc123/reminders?status=overdue')).toMatchObject({
      pathname: '/vehicles/abc123',
      search: { tab: 'reminders' },
    });
  });

  it('replaces the old entry, so Back does not bounce through the redirect', async () => {
    const { history } = await land('/vehicles/abc123/reminders');
    expect(history.length).toBe(1);
  });

  it('leaves the create pages under them where they are', async () => {
    expect((await land('/vehicles/abc123/maintenance/new')).pathname).toBe(
      '/vehicles/abc123/maintenance/new',
    );
    expect((await land('/vehicles/abc123/reminders/new')).pathname).toBe(
      '/vehicles/abc123/reminders/new',
    );
  });

  it('rewrites an old ?tab= value to the tab it moved to', async () => {
    expect(await land('/vehicles/abc123?tab=protection')).toMatchObject({
      pathname: '/vehicles/abc123',
      search: { tab: 'papers' },
    });
    expect(await land('/vehicles/abc123?tab=fuel')).toMatchObject({
      search: { tab: 'history', view: 'fuel' },
    });
    expect(await land('/vehicles/abc123?tab=tyres')).toMatchObject({
      search: { tab: 'more', section: 'tyres' },
    });
  });
});
