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
    title: 'Loading your garage',
    description: 'Loading your garage.',
  },
);

function GarageRouteComponent() {
  const search = garageRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<VehicleListSearch>) {
    void navigate({
      to: '/garage',
      search: (previous) => normalizeVehicleListSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return <VehiclesListPage onSearchStateChange={updateSearch} searchState={search} />;
}

export const garageRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'garage',
  validateSearch: normalizeVehicleListSearch,
  component: GarageRouteComponent,
});
