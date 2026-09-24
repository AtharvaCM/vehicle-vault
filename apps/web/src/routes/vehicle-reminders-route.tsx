import { createRoute, redirect } from '@tanstack/react-router';

import { appRoute } from './app-route';

/**
 * A vehicle's reminders used to have a page of their own as well as a tab
 * (#278). The Reminders tab is the one place now; this address, kept for old
 * links and bookmarks, forwards to it and replaces itself in the history.
 */
export const vehicleRemindersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/reminders',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/vehicles/$vehicleId',
      params,
      search: { tab: 'reminders' },
      replace: true,
    });
  },
});
