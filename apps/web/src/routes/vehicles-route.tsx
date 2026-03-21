import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const VehiclesListPage = createLazyPage(
  () =>
    import('@/features/vehicles/pages/vehicles-list-page').then((module) => ({
      default: module.VehiclesListPage,
    })),
  {
    title: 'Loading vehicles',
    description: 'Loading your garage.',
  },
);

export const vehiclesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles',
  component: VehiclesListPage,
});
