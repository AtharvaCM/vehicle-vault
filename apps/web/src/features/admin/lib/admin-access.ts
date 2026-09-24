type AccessUser = { role?: string; allowedCatalogSources?: string[] } | null | undefined;

/** The user directory and force sign-out: admins only. */
export function canSeeUsers(user: AccessUser): boolean {
  return user?.role === 'admin';
}

/**
 * Catalog curation: admins, and curators trusted with one or more catalog
 * sources (`allowedCatalogSources`), whom the API lets review their own.
 */
export function canSeeCatalogReview(user: AccessUser): boolean {
  if (!user) return false;
  return user.role === 'admin' || (user.allowedCatalogSources?.length ?? 0) > 0;
}

/** Anyone with at least one admin section. Everyone else is sent Home. */
export function canSeeAdmin(user: AccessUser): boolean {
  return canSeeUsers(user) || canSeeCatalogReview(user);
}

/** Where `/admin` opens: the first section this user may see. */
export function adminLanding(user: AccessUser): '/admin/users' | '/admin/catalog' | '/home' {
  if (canSeeUsers(user)) return '/admin/users';
  if (canSeeCatalogReview(user)) return '/admin/catalog';
  return '/home';
}
