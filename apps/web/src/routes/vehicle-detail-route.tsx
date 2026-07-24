import { createRoute, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  normalizeVehicleDetailSearch,
  type VehicleDetailSearch,
} from '@/features/vehicles/types/vehicle-detail-search';

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
  const search = vehicleDetailRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<VehicleDetailSearch>) {
    void navigate({
      to: '/vehicles/$vehicleId',
      params: { vehicleId },
      search: (previous) => normalizeVehicleDetailSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return (
    <VehicleDetailPage
      onSearchStateChange={updateSearch}
      searchState={search}
      vehicleId={vehicleId}
    />
  );
}

export const vehicleDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId',
  validateSearch: normalizeVehicleDetailSearch,
  component: VehicleDetailRouteComponent,
});
