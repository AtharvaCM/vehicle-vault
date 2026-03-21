import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const VehicleMaintenanceListPage = createLazyPage(
  () =>
    import('@/features/maintenance/pages/vehicle-maintenance-list-page').then((module) => ({
      default: module.VehicleMaintenanceListPage,
    })),
  {
    title: 'Loading maintenance history',
    description: 'Preparing the service records for this vehicle.',
  },
);

function VehicleMaintenanceRouteComponent() {
  const { vehicleId } = vehicleMaintenanceRoute.useParams();

  return <VehicleMaintenanceListPage vehicleId={vehicleId} />;
}

export const vehicleMaintenanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/maintenance',
  component: VehicleMaintenanceRouteComponent,
});
