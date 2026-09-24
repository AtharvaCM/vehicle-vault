import { createRoute, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  normalizeReminderListSearch,
  type ReminderListSearch,
} from '@/features/reminders/types/reminder-list-search';

const RemindersPage = createLazyPage(
  () =>
    import('@/features/reminders/pages/reminders-page').then((module) => ({
      default: module.RemindersPage,
    })),
  {
    title: "Loading what's due",
    description: 'Loading your reminder list.',
  },
);

function UpcomingRouteComponent() {
  const search = upcomingRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<ReminderListSearch>) {
    void navigate({
      to: '/upcoming',
      search: (previous) => normalizeReminderListSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return <RemindersPage onSearchStateChange={updateSearch} searchState={search} />;
}

export const upcomingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'upcoming',
  validateSearch: normalizeReminderListSearch,
  component: UpcomingRouteComponent,
});
