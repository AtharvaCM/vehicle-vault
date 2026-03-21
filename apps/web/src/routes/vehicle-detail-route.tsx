import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const VehicleDetailPage = createLazyPage(
  () =>
    import('@/features/vehicles/pages/vehicle-detail-page').then((module) => ({
      default: module.VehicleDetailPage,
    })),
  {
    title: 'Loading vehicle',
    description: 'Loading this vehicle.',
  },
);

function VehicleDetailRouteComponent() {
  const { vehicleId } = vehicleDetailRoute.useParams();

  return <VehicleDetailPage vehicleId={vehicleId} />;
}

export const vehicleDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId',
  component: VehicleDetailRouteComponent,
});
