import { createRoute } from '@tanstack/react-router';

import { MaintenanceRecordDetailPage } from '@/features/maintenance/pages/maintenance-record-detail-page';

import { rootRoute } from './root-route';

function MaintenanceRecordDetailRouteComponent() {
  const { recordId } = maintenanceRecordDetailRoute.useParams();

  return <MaintenanceRecordDetailPage recordId={recordId} />;
}

export const maintenanceRecordDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'maintenance-records/$recordId',
  component: MaintenanceRecordDetailRouteComponent,
});
