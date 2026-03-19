import { createRoute } from '@tanstack/react-router';

import { VehicleCreatePage } from '@/features/vehicles/pages/vehicle-create-page';

import { appRoute } from './app-route';

export const vehiclesNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/new',
  component: VehicleCreatePage,
});
