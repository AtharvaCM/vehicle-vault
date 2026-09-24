import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { routeTree } from '@/app/router';

async function land(href: string, user: { role: string; allowedCatalogSources: string[] }) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [href] }),
    context: { auth: { isAuthenticated: true, user } as never, queryClient: new QueryClient() },
  });
  await router.load().catch(() => undefined);
  return router.state.location.pathname;
}

const admin = { role: 'admin', allowedCatalogSources: [] };
const curator = { role: 'user', allowedCatalogSources: ['tata-india'] };
const owner = { role: 'user', allowedCatalogSources: [] };

// The first load of the real tree also pulls in the dev-only devtools.
describe('the admin area', { timeout: 30_000 }, () => {
  it('opens on Users for an admin, who can reach both sections', async () => {
    expect(await land('/admin', admin)).toBe('/admin/users');
    expect(await land('/admin/users', admin)).toBe('/admin/users');
    expect(await land('/admin/catalog', admin)).toBe('/admin/catalog');
  });

  it('keeps a curator to Catalog curation', async () => {
    expect(await land('/admin', curator)).toBe('/admin/catalog');
    expect(await land('/admin/users', curator)).toBe('/admin/catalog');
    expect(await land('/admin/catalog', curator)).toBe('/admin/catalog');
  });

  it('sends everyone else Home', async () => {
    for (const path of ['/admin', '/admin/users', '/admin/catalog']) {
      expect(await land(path, owner)).toBe('/home');
    }
  });
});
