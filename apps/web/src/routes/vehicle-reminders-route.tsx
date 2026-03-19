import { createRoute } from '@tanstack/react-router';

import { VehicleRemindersPage } from '@/features/reminders/pages/vehicle-reminders-page';

import { appRoute } from './app-route';

function VehicleRemindersRouteComponent() {
  const { vehicleId } = vehicleRemindersRoute.useParams();

  return <VehicleRemindersPage vehicleId={vehicleId} />;
}

export const vehicleRemindersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/reminders',
  component: VehicleRemindersRouteComponent,
});
