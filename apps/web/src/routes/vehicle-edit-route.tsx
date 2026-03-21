import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const VehicleEditPage = createLazyPage(
  () =>
    import('@/features/vehicles/pages/vehicle-edit-page').then((module) => ({
      default: module.VehicleEditPage,
    })),
  {
    title: 'Loading vehicle form',
    description: 'Loading this vehicle for editing.',
  },
);

function VehicleEditRouteComponent() {
  const { vehicleId } = vehicleEditRoute.useParams();

  return <VehicleEditPage vehicleId={vehicleId} />;
}

export const vehicleEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/edit',
  component: VehicleEditRouteComponent,
});
