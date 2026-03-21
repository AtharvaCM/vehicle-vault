import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const VehicleCreatePage = createLazyPage(
  () =>
    import('@/features/vehicles/pages/vehicle-create-page').then((module) => ({
      default: module.VehicleCreatePage,
    })),
  {
    title: 'Loading vehicle form',
    description: 'Preparing the new vehicle workflow.',
  },
);

export const vehiclesNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/new',
  component: VehicleCreatePage,
});
