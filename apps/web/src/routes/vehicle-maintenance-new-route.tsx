import { createRoute } from '@tanstack/react-router';

import { normalizeMaintenanceCreateSearch } from '@/features/maintenance/types/maintenance-create-search';

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
  // Re-normalised: TanStack's search is non-strict and leaks unknown raw params.
  const search = normalizeMaintenanceCreateSearch(vehicleMaintenanceNewRoute.useSearch());

  return (
    <VehicleMaintenanceCreatePage
      category={search.category}
      reminderId={search.reminderId}
      vehicleId={vehicleId}
    />
  );
}

export const vehicleMaintenanceNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/maintenance/new',
  validateSearch: normalizeMaintenanceCreateSearch,
  component: VehicleMaintenanceNewRouteComponent,
});
