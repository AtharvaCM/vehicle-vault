import { createRoute, redirect, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  legacyVehicleDetailRedirect,
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
  // A link to one of the eleven old tabs (an alert sent before the page had
  // five, a bookmark) opens the right tab either way, since validateSearch maps
  // it; this also rewrites the address, so it reads what is on screen.
  beforeLoad: ({ location, params }) => {
    const legacy = legacyVehicleDetailRedirect(location.search as Record<string, unknown>);
    if (legacy) {
      throw redirect({
        to: '/vehicles/$vehicleId',
        params,
        search: legacy,
        replace: true,
      });
    }
  },
  component: VehicleDetailRouteComponent,
});
