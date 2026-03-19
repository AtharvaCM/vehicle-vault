import { createRoute } from '@tanstack/react-router';

import { SettingsPage } from '@/features/settings/pages/settings-page';

import { appRoute } from './app-route';

export const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'settings',
  component: SettingsPage,
});
