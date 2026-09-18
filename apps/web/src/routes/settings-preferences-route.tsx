import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const NotificationPreferencesPage = createLazyPage(
  () =>
    import('@/features/settings/pages/notification-preferences-page').then((module) => ({
      default: module.NotificationPreferencesPage,
    })),
  {
    title: 'Loading preferences',
    description: 'Loading your notification preferences.',
  },
);

export const settingsPreferencesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings/preferences',
  component: NotificationPreferencesPage,
});
