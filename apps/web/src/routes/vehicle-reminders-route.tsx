import { createRoute, useNavigate } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';
import {
  normalizeReminderListSearch,
  type ReminderListSearch,
} from '@/features/reminders/types/reminder-list-search';

const VehicleRemindersPage = createLazyPage(
  () =>
    import('@/features/reminders/pages/vehicle-reminders-page').then((module) => ({
      default: module.VehicleRemindersPage,
    })),
  {
    title: 'Loading reminders',
    description: 'Loading reminders for this vehicle.',
  },
);

function VehicleRemindersRouteComponent() {
  const { vehicleId } = vehicleRemindersRoute.useParams();
  const search = vehicleRemindersRoute.useSearch();
  const navigate = useNavigate();

  function updateSearch(next: Partial<ReminderListSearch>) {
    void navigate({
      to: '/vehicles/$vehicleId/reminders',
      params: { vehicleId },
      search: (previous) => normalizeReminderListSearch({ ...previous, ...next }),
      replace: true,
    });
  }

  return (
    <VehicleRemindersPage
      onSearchStateChange={updateSearch}
      searchState={search}
      vehicleId={vehicleId}
    />
  );
}

export const vehicleRemindersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/reminders',
  validateSearch: normalizeReminderListSearch,
  component: VehicleRemindersRouteComponent,
});
