import { Outlet, createRoute, redirect } from '@tanstack/react-router';

import {
  adminLanding,
  canSeeAdmin,
  canSeeCatalogReview,
  canSeeUsers,
} from '@/features/admin/lib/admin-access';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const AdminUsersPage = createLazyPage(
  () =>
    import('@/features/admin/pages/admin-users-page').then((module) => ({
      default: module.AdminUsersPage,
    })),
  {
    title: 'Loading users',
    description: 'Loading the user directory.',
  },
);

const CatalogCurationPage = createLazyPage(
  () =>
    import('@/features/admin/pages/catalog-curation-page').then((module) => ({
      default: module.CatalogCurationPage,
    })),
  {
    title: 'Loading catalog curation',
    description: 'Loading the staged catalog imports.',
  },
);

/**
 * The admin area: Users (admins) and Catalog curation (admins, and curators
 * trusted with a catalog source). Anyone with neither is sent Home, as the
 * old `/admin/users` did; the API refuses them either way.
 */
export const adminRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'admin',
  beforeLoad: ({ context }) => {
    if (!canSeeAdmin(context.auth.user)) {
      throw redirect({ to: '/home' });
    }
  },
  component: Outlet,
});

/** `/admin` opens on the first section this user may see. */
export const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    throw redirect({ to: adminLanding(context.auth.user), replace: true });
  },
});

export const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'users',
  beforeLoad: ({ context }) => {
    if (!canSeeUsers(context.auth.user)) {
      throw redirect({ to: adminLanding(context.auth.user) });
    }
  },
  component: AdminUsersPage,
});

export const adminCatalogRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: 'catalog',
  beforeLoad: ({ context }) => {
    if (!canSeeCatalogReview(context.auth.user)) {
      throw redirect({ to: adminLanding(context.auth.user) });
    }
  },
  component: CatalogCurationPage,
});
