import { createRoute } from '@tanstack/react-router';

import { VehicleReminderCreatePage } from '@/features/reminders/pages/vehicle-reminder-create-page';

import { appRoute } from './app-route';

function VehicleRemindersNewRouteComponent() {
  const { vehicleId } = vehicleRemindersNewRoute.useParams();

  return <VehicleReminderCreatePage vehicleId={vehicleId} />;
}

export const vehicleRemindersNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/reminders/new',
  component: VehicleRemindersNewRouteComponent,
});
