import { createRoute } from '@tanstack/react-router';

import { VehicleMaintenanceCreatePage } from '@/features/maintenance/pages/vehicle-maintenance-create-page';

import { appRoute } from './app-route';

function VehicleMaintenanceNewRouteComponent() {
  const { vehicleId } = vehicleMaintenanceNewRoute.useParams();

  return <VehicleMaintenanceCreatePage vehicleId={vehicleId} />;
}

export const vehicleMaintenanceNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/maintenance/new',
  component: VehicleMaintenanceNewRouteComponent,
});
