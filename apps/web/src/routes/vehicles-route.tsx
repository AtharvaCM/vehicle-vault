import { createRoute, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  normalizeVehicleListSearch,
  type VehicleListSearch,
} from '@/features/vehicles/types/vehicle-list-search';

const VehiclesListPage = createLazyPage(
  () =>
    import('@/features/vehicles/pages/vehicles-list-page').then((module) => ({
      default: module.VehiclesListPage,
    })),
  {
    title: 'Loading vehicles',
    description: 'Loading your garage.',
  },
);

function VehiclesRouteComponent() {
  const search = vehiclesRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<VehicleListSearch>) {
    void navigate({
      to: '/vehicles',
      search: (previous) => normalizeVehicleListSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return <VehiclesListPage onSearchStateChange={updateSearch} searchState={search} />;
}

export const vehiclesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles',
  validateSearch: normalizeVehicleListSearch,
  component: VehiclesRouteComponent,
});
