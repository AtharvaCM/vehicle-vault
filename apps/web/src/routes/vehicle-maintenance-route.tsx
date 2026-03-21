import { createRoute, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  normalizeMaintenanceListSearch,
  type MaintenanceListSearch,
} from '@/features/maintenance/types/maintenance-list-search';

const VehicleMaintenanceListPage = createLazyPage(
  () =>
    import('@/features/maintenance/pages/vehicle-maintenance-list-page').then((module) => ({
      default: module.VehicleMaintenanceListPage,
    })),
  {
    title: 'Loading maintenance history',
    description: 'Loading service history for this vehicle.',
  },
);

function VehicleMaintenanceRouteComponent() {
  const { vehicleId } = vehicleMaintenanceRoute.useParams();
  const search = vehicleMaintenanceRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<MaintenanceListSearch>) {
    void navigate({
      to: '/vehicles/$vehicleId/maintenance',
      params: { vehicleId },
      search: (previous) => normalizeMaintenanceListSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return (
    <VehicleMaintenanceListPage
      onSearchStateChange={updateSearch}
      searchState={search}
      vehicleId={vehicleId}
    />
  );
}

export const vehicleMaintenanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/maintenance',
  validateSearch: normalizeMaintenanceListSearch,
  component: VehicleMaintenanceRouteComponent,
});
