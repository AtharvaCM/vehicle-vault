import { describe, expect, it } from 'vitest';

import { canSeeCatalogSource, visibleCatalogSources } from './catalog-source-visibility';

describe('catalog source visibility', () => {
  it('shows an admin every source, grants or not', () => {
    expect(visibleCatalogSources({ role: 'admin', allowedCatalogSources: [] })).toBe('all');
  });

  it('treats the wildcard grant as every source', () => {
    expect(visibleCatalogSources({ role: 'user', allowedCatalogSources: ['*'] })).toBe('all');
  });

  it('limits everyone else to exactly their grants', () => {
    const user = { role: 'user' as const, allowedCatalogSources: ['tata-india'] };

    expect(visibleCatalogSources(user)).toEqual(['tata-india']);
    expect(canSeeCatalogSource(user, 'tata-india')).toBe(true);
    expect(canSeeCatalogSource(user, 'hyundai-india')).toBe(false);
  });

  it('shows a user with no grants nothing', () => {
    const user = { role: 'user' as const, allowedCatalogSources: [] };

    expect(visibleCatalogSources(user)).toEqual([]);
    expect(canSeeCatalogSource(user, 'tata-india')).toBe(false);
  });
});
