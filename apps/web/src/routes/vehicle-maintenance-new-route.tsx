import { createRoute } from '@tanstack/react-router';

import { VehicleMaintenanceCreatePage } from '@/features/maintenance/pages/vehicle-maintenance-create-page';

import { rootRoute } from './root-route';

function VehicleMaintenanceNewRouteComponent() {
  const { vehicleId } = vehicleMaintenanceNewRoute.useParams();

  return <VehicleMaintenanceCreatePage vehicleId={vehicleId} />;
}

export const vehicleMaintenanceNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'vehicles/$vehicleId/maintenance/new',
  component: VehicleMaintenanceNewRouteComponent,
});
