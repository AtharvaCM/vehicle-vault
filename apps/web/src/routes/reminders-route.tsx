import { createRoute } from '@tanstack/react-router';

import { RemindersPage } from '@/features/reminders/pages/reminders-page';

import { appRoute } from './app-route';

export const remindersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'reminders',
  component: RemindersPage,
});
