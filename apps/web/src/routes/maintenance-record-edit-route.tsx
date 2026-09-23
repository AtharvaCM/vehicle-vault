import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const MaintenanceRecordEditPage = createLazyPage(
  () =>
    import('@/features/maintenance/pages/maintenance-record-edit-page').then((module) => ({
      default: module.MaintenanceRecordEditPage,
    })),
  {
    title: 'Loading service form',
    description: 'Loading this service record for editing.',
  },
);

function MaintenanceRecordEditRouteComponent() {
  const { recordId } = maintenanceRecordEditRoute.useParams();

  return <MaintenanceRecordEditPage recordId={recordId} />;
}

export const maintenanceRecordEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'maintenance-records/$recordId/edit',
  component: MaintenanceRecordEditRouteComponent,
});
