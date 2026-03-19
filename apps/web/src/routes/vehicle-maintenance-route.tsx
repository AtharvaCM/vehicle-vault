import { createRoute } from '@tanstack/react-router';

import { VehicleMaintenanceListPage } from '@/features/maintenance/pages/vehicle-maintenance-list-page';

import { appRoute } from './app-route';

function VehicleMaintenanceRouteComponent() {
  const { vehicleId } = vehicleMaintenanceRoute.useParams();

  return <VehicleMaintenanceListPage vehicleId={vehicleId} />;
}

export const vehicleMaintenanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/maintenance',
  component: VehicleMaintenanceRouteComponent,
});
