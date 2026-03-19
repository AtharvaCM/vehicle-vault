import { createRoute } from '@tanstack/react-router';

import { VehiclesListPage } from '@/features/vehicles/pages/vehicles-list-page';

import { appRoute } from './app-route';

export const vehiclesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles',
  component: VehiclesListPage,
});
