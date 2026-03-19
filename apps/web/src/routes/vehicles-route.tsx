import { createRoute } from '@tanstack/react-router';

import { VehiclesListPage } from '@/features/vehicles/pages/vehicles-list-page';

import { rootRoute } from './root-route';

export const vehiclesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'vehicles',
  component: VehiclesListPage,
});
