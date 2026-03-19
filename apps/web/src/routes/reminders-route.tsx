import { createRoute } from '@tanstack/react-router';

import { RemindersPage } from '@/features/reminders/pages/reminders-page';

import { rootRoute } from './root-route';

export const remindersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'reminders',
  component: RemindersPage,
});
