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
    title: 'Loading reminders',
    description: 'Loading your reminder list.',
  },
);

function RemindersRouteComponent() {
  const search = remindersRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<ReminderListSearch>) {
    void navigate({
      to: '/reminders',
      search: (previous) => normalizeReminderListSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return <RemindersPage onSearchStateChange={updateSearch} searchState={search} />;
}

export const remindersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'reminders',
  validateSearch: normalizeReminderListSearch,
  component: RemindersRouteComponent,
});
