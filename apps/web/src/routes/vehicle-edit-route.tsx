import { createRoute } from '@tanstack/react-router';

import { VehicleEditPage } from '@/features/vehicles/pages/vehicle-edit-page';

import { appRoute } from './app-route';

function VehicleEditRouteComponent() {
  const { vehicleId } = vehicleEditRoute.useParams();

  return <VehicleEditPage vehicleId={vehicleId} />;
}

export const vehicleEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/edit',
  component: VehicleEditRouteComponent,
});
