import { createRoute } from '@tanstack/react-router';

import { VehicleRemindersPage } from '@/features/reminders/pages/vehicle-reminders-page';

import { rootRoute } from './root-route';

function VehicleRemindersRouteComponent() {
  const { vehicleId } = vehicleRemindersRoute.useParams();

  return <VehicleRemindersPage vehicleId={vehicleId} />;
}

export const vehicleRemindersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'vehicles/$vehicleId/reminders',
  component: VehicleRemindersRouteComponent,
});
