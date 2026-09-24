import { createRoute, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  normalizeDashboardSearch,
  type DashboardSearch,
} from '@/features/dashboard/types/dashboard-search';

const DashboardPage = createLazyPage(
  () =>
    import('@/features/dashboard/pages/dashboard-page').then((module) => ({
      default: module.DashboardPage,
    })),
  {
    title: 'Loading Home',
    description: 'Loading your garage summary.',
  },
);

function HomeRouteComponent() {
  // `useSearch` is non-strict by default: raw URL params that `validateSearch` dropped can
  // still appear here, so re-normalise before anything indexes on `focus`.
  const search = normalizeDashboardSearch(homeRoute.useSearch());
  const navigate = useNavigate();

  function updateSearch(next: Partial<DashboardSearch>) {
    void navigate({
      to: '/home',
      search: (previous) => normalizeDashboardSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return <DashboardPage onSearchStateChange={updateSearch} searchState={search} />;
}

export const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'home',
  validateSearch: normalizeDashboardSearch,
  component: HomeRouteComponent,
});
