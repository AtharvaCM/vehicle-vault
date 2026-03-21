import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const SettingsPage = createLazyPage(
  () =>
    import('@/features/settings/pages/settings-page').then((module) => ({
      default: module.SettingsPage,
    })),
  {
    title: 'Loading settings',
    description: 'Loading your account and backup tools.',
  },
);

export const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings',
  component: SettingsPage,
});
