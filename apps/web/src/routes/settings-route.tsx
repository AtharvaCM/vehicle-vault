import { createRoute } from '@tanstack/react-router';

import { SettingsPage } from '@/features/settings/pages/settings-page';

import { rootRoute } from './root-route';

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: SettingsPage,
});
