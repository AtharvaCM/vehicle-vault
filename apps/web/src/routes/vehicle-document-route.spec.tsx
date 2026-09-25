import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { routeTree } from '@/app/router';

import { normalizeShowPapersSearch } from './vehicle-document-route';

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
describe('Show papers addresses', { timeout: 30_000 }, () => {
  it("opens an old one-document link on that paper's tab, showing that document", async () => {
    expect(await land('/vehicles/abc123/documents/puc/doc-9')).toMatchObject({
      pathname: '/vehicles/abc123/papers',
      search: { paper: 'puc', document: 'doc-9' },
    });
  });

  it('replaces the old entry, so Back does not bounce through the redirect', async () => {
    const { history } = await land('/vehicles/abc123/documents/insurance/doc-1');
    expect(history.length).toBe(1);
  });

  it('keeps the tab asked for', async () => {
    expect(await land('/vehicles/abc123/papers?paper=road_tax')).toMatchObject({
      pathname: '/vehicles/abc123/papers',
      search: { paper: 'road_tax' },
    });
  });
});

describe('normalizeShowPapersSearch', () => {
  it('drops a paper kind that does not exist, and an empty document', () => {
    expect(normalizeShowPapersSearch({ paper: 'passport', document: '' })).toEqual({});
    expect(normalizeShowPapersSearch({ paper: 'registration', document: 'doc-1' })).toEqual({
      paper: 'registration',
      document: 'doc-1',
    });
  });
});
