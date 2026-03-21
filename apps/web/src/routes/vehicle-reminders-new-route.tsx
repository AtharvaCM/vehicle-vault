import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const VehicleReminderCreatePage = createLazyPage(
  () =>
    import('@/features/reminders/pages/vehicle-reminder-create-page').then((module) => ({
      default: module.VehicleReminderCreatePage,
    })),
  {
    title: 'Loading reminder form',
    description: 'Loading the new reminder form.',
  },
);

function VehicleRemindersNewRouteComponent() {
  const { vehicleId } = vehicleRemindersNewRoute.useParams();

  return <VehicleReminderCreatePage vehicleId={vehicleId} />;
}

export const vehicleRemindersNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/reminders/new',
  component: VehicleRemindersNewRouteComponent,
});
