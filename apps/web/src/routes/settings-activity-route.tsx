import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const ActivityPage = createLazyPage(
  () =>
    import('@/features/settings/pages/activity-page').then((module) => ({
      default: module.ActivityPage,
    })),
  {
    title: 'Loading activity',
    description: 'Loading your account activity log.',
  },
);

export const settingsActivityRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings/activity',
  component: ActivityPage,
});
