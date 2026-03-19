import { createRoute } from '@tanstack/react-router';

import { VehicleMaintenanceListPage } from '@/features/maintenance/pages/vehicle-maintenance-list-page';

import { rootRoute } from './root-route';

function VehicleMaintenanceRouteComponent() {
  const { vehicleId } = vehicleMaintenanceRoute.useParams();

  return <VehicleMaintenanceListPage vehicleId={vehicleId} />;
}

export const vehicleMaintenanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'vehicles/$vehicleId/maintenance',
  component: VehicleMaintenanceRouteComponent,
});
