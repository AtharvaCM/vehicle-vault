import { createRoute, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  normalizeMaintenanceListSearch,
  type MaintenanceListSearch,
} from '@/features/maintenance/types/maintenance-list-search';

const MaintenanceOverviewPage = createLazyPage(
  () =>
    import('@/features/maintenance/pages/maintenance-overview-page').then((module) => ({
      default: module.MaintenanceOverviewPage,
    })),
  {
    title: 'Loading maintenance',
    description: 'Loading your service history.',
  },
);

function MaintenanceRouteComponent() {
  const search = maintenanceRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<MaintenanceListSearch>) {
    void navigate({
      to: '/maintenance',
      search: (previous) => normalizeMaintenanceListSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return <MaintenanceOverviewPage onSearchStateChange={updateSearch} searchState={search} />;
}

export const maintenanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'maintenance',
  validateSearch: normalizeMaintenanceListSearch,
  component: MaintenanceRouteComponent,
});
