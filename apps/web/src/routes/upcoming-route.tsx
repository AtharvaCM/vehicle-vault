import { createRoute, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  normalizeUpcomingSearch,
  type UpcomingSearch,
} from '@/features/upcoming/types/upcoming-search';

const UpcomingPage = createLazyPage(
  () =>
    import('@/features/upcoming/pages/upcoming-page').then((module) => ({
      default: module.UpcomingPage,
    })),
  {
    title: "Loading what's due",
    description: 'Loading everything coming up across your garage.',
  },
);

function UpcomingRouteComponent() {
  // Non-strict by default: re-normalise so a stray param never reaches the query.
  const search = normalizeUpcomingSearch(upcomingRoute.useSearch());
  const navigate = useNavigate();

  function updateSearch(next: Partial<UpcomingSearch>) {
    void navigate({
      to: '/upcoming',
      search: (previous) => normalizeUpcomingSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return <UpcomingPage onSearchStateChange={updateSearch} searchState={search} />;
}

export const upcomingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'upcoming',
  validateSearch: normalizeUpcomingSearch,
  component: UpcomingRouteComponent,
});
