import { createRoute } from '@tanstack/react-router';

import { VehicleCreatePage } from '@/features/vehicles/pages/vehicle-create-page';

import { rootRoute } from './root-route';

export const vehiclesNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'vehicles/new',
  component: VehicleCreatePage,
});
