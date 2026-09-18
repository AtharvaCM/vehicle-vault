import type { AuthUser } from '@vehicle-vault/shared';

/**
 * Which catalog sources' import runs a user may *see* — the review card's list
 * and a run's detail. Admins see every source, as does the `*` grant; anyone
 * else sees exactly the sources they are granted.
 *
 * Visibility only. Publishing, reviewing an offering and archiving missing
 * variants change the trusted catalog, and those stay gated by grants alone in
 * `VehicleCatalogService` — an admin without a grant can look but not publish.
 */
export function visibleCatalogSources(
  user: Pick<AuthUser, 'role' | 'allowedCatalogSources'>,
): 'all' | string[] {
  if (user.role === 'admin' || user.allowedCatalogSources.includes('*')) {
    return 'all';
  }

  return user.allowedCatalogSources;
}

export function canSeeCatalogSource(
  user: Pick<AuthUser, 'role' | 'allowedCatalogSources'>,
  sourceKey: string,
): boolean {
  const sees = visibleCatalogSources(user);
  return sees === 'all' || sees.includes(sourceKey);
}
