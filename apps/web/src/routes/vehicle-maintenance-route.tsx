import { createRoute, redirect } from '@tanstack/react-router';

import { appRoute } from './app-route';

/**
 * A vehicle's service history used to have a page of its own as well as a tab
 * (#278). The History tab is the one place now; this address, kept for old
 * links and bookmarks, forwards to it and replaces itself in the history.
 */
export const vehicleMaintenanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/maintenance',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/vehicles/$vehicleId',
      params,
      search: { tab: 'history' },
      replace: true,
    });
  },
});
