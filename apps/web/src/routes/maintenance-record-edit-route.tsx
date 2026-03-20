import { createRoute } from '@tanstack/react-router';

import { MaintenanceRecordEditPage } from '@/features/maintenance/pages/maintenance-record-edit-page';

import { appRoute } from './app-route';

function MaintenanceRecordEditRouteComponent() {
  const { recordId } = maintenanceRecordEditRoute.useParams();

  return <MaintenanceRecordEditPage recordId={recordId} />;
}

export const maintenanceRecordEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'maintenance-records/$recordId/edit',
  component: MaintenanceRecordEditRouteComponent,
});
