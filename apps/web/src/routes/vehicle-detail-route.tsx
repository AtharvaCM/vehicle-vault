import { createRoute } from '@tanstack/react-router';

import { VehicleDetailPage } from '@/features/vehicles/pages/vehicle-detail-page';

import { appRoute } from './app-route';

function VehicleDetailRouteComponent() {
  const { vehicleId } = vehicleDetailRoute.useParams();

  return <VehicleDetailPage vehicleId={vehicleId} />;
}

export const vehicleDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId',
  component: VehicleDetailRouteComponent,
});
