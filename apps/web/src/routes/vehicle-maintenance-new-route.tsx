import { createRoute } from '@tanstack/react-router';

import { normalizeLogServiceSearch } from '@/features/maintenance/types/log-service-search';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const VehicleMaintenanceCreatePage = createLazyPage(
  () =>
    import('@/features/maintenance/pages/vehicle-maintenance-create-page').then((module) => ({
      default: module.VehicleMaintenanceCreatePage,
    })),
  {
    title: 'Loading service form',
    description: 'Loading the new service record form.',
  },
);

function VehicleMaintenanceNewRouteComponent() {
  const { vehicleId } = vehicleMaintenanceNewRoute.useParams();

  return <VehicleMaintenanceCreatePage vehicleId={vehicleId} />;
}

export const vehicleMaintenanceNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/maintenance/new',
  // `?category=&reminderId=`: a reminder's "Log the service now" (see LogServiceSearch).
  validateSearch: normalizeLogServiceSearch,
  component: VehicleMaintenanceNewRouteComponent,
});
