import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const MaintenanceRecordDetailPage = createLazyPage(
  () =>
    import('@/features/maintenance/pages/maintenance-record-detail-page').then((module) => ({
      default: module.MaintenanceRecordDetailPage,
    })),
  {
    title: 'Loading service record',
    description: 'Loading this service record.',
  },
);

function MaintenanceRecordDetailRouteComponent() {
  const { recordId } = maintenanceRecordDetailRoute.useParams();

  return <MaintenanceRecordDetailPage recordId={recordId} />;
}

export const maintenanceRecordDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'maintenance-records/$recordId',
  component: MaintenanceRecordDetailRouteComponent,
});
