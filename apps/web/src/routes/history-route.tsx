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
    title: 'Loading history',
    description: 'Loading your service history.',
  },
);

function HistoryRouteComponent() {
  const search = historyRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<MaintenanceListSearch>) {
    void navigate({
      to: '/history',
      search: (previous) => normalizeMaintenanceListSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return <MaintenanceOverviewPage onSearchStateChange={updateSearch} searchState={search} />;
}

export const historyRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'history',
  validateSearch: normalizeMaintenanceListSearch,
  component: HistoryRouteComponent,
});
