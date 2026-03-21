import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const RemindersPage = createLazyPage(
  () =>
    import('@/features/reminders/pages/reminders-page').then((module) => ({
      default: module.RemindersPage,
    })),
  {
    title: 'Loading reminders',
    description: 'Loading your reminder list.',
  },
);

export const remindersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'reminders',
  component: RemindersPage,
});
