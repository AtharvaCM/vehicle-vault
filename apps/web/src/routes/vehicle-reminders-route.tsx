import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const VehicleRemindersPage = createLazyPage(
  () =>
    import('@/features/reminders/pages/vehicle-reminders-page').then((module) => ({
      default: module.VehicleRemindersPage,
    })),
  {
    title: 'Loading reminders',
    description: 'Preparing the reminder list for this vehicle.',
  },
);

function VehicleRemindersRouteComponent() {
  const { vehicleId } = vehicleRemindersRoute.useParams();

  return <VehicleRemindersPage vehicleId={vehicleId} />;
}

export const vehicleRemindersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/reminders',
  component: VehicleRemindersRouteComponent,
});
