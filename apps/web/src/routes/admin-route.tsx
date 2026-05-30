import { createRoute, redirect } from '@tanstack/react-router';

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

export const adminUsersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'admin/users',
  beforeLoad: ({ context }) => {
    if (context.auth.user?.role !== 'admin') {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: AdminUsersPage,
});
