import { createRoute } from '@tanstack/react-router';

import { VehicleReminderCreatePage } from '@/features/reminders/pages/vehicle-reminder-create-page';

import { rootRoute } from './root-route';

function VehicleRemindersNewRouteComponent() {
  const { vehicleId } = vehicleRemindersNewRoute.useParams();

  return <VehicleReminderCreatePage vehicleId={vehicleId} />;
}

export const vehicleRemindersNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'vehicles/$vehicleId/reminders/new',
  component: VehicleRemindersNewRouteComponent,
});
