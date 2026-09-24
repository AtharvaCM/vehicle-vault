import { describe, expect, it } from 'vitest';

import { adminLanding, canSeeAdmin, canSeeCatalogReview, canSeeUsers } from './admin-access';

const admin = { role: 'admin', allowedCatalogSources: [] };
const curator = { role: 'user', allowedCatalogSources: ['tata-india'] };
const owner = { role: 'user', allowedCatalogSources: [] };

describe('admin access', () => {
  it('gives admins both sections, opening on Users', () => {
    expect(canSeeUsers(admin)).toBe(true);
    expect(canSeeCatalogReview(admin)).toBe(true);
    expect(adminLanding(admin)).toBe('/admin/users');
  });

  it('gives a curator Catalog curation only', () => {
    expect(canSeeUsers(curator)).toBe(false);
    expect(canSeeCatalogReview(curator)).toBe(true);
    expect(canSeeAdmin(curator)).toBe(true);
    expect(adminLanding(curator)).toBe('/admin/catalog');
  });

  it('gives everyone else nothing, and sends them Home', () => {
    for (const user of [owner, {}, null, undefined]) {
      expect(canSeeAdmin(user)).toBe(false);
      expect(adminLanding(user)).toBe('/home');
    }
  });
});
