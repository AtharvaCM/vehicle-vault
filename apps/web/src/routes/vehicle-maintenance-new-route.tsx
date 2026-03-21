import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const VehicleMaintenanceCreatePage = createLazyPage(
  () =>
    import('@/features/maintenance/pages/vehicle-maintenance-create-page').then((module) => ({
      default: module.VehicleMaintenanceCreatePage,
    })),
  {
    title: 'Loading maintenance form',
    description: 'Loading the new service entry form.',
  },
);

function VehicleMaintenanceNewRouteComponent() {
  const { vehicleId } = vehicleMaintenanceNewRoute.useParams();

  return <VehicleMaintenanceCreatePage vehicleId={vehicleId} />;
}

export const vehicleMaintenanceNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/maintenance/new',
  component: VehicleMaintenanceNewRouteComponent,
});
