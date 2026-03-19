import { createRoute } from '@tanstack/react-router';

import { VehicleDetailPage } from '@/features/vehicles/pages/vehicle-detail-page';

import { rootRoute } from './root-route';

function VehicleDetailRouteComponent() {
  const { vehicleId } = vehicleDetailRoute.useParams();

  return <VehicleDetailPage vehicleId={vehicleId} />;
}

export const vehicleDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'vehicles/$vehicleId',
  component: VehicleDetailRouteComponent,
});
