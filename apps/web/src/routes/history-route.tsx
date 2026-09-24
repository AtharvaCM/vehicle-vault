import { createRoute, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  normalizeHistorySearch,
  type HistorySearch,
} from '@/features/history/types/history-search';

const HistoryPage = createLazyPage(
  () =>
    import('@/features/history/pages/history-page').then((module) => ({
      default: module.HistoryPage,
    })),
  {
    title: 'Loading history',
    description: 'Loading what was done across your garage.',
  },
);

function HistoryRouteComponent() {
  const search = historyRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<HistorySearch>) {
    void navigate({
      to: '/history',
      search: (previous) => normalizeHistorySearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return <HistoryPage onSearchStateChange={updateSearch} searchState={search} />;
}

export const historyRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'history',
  validateSearch: normalizeHistorySearch,
  component: HistoryRouteComponent,
});
