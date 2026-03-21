import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const MaintenanceRecordDetailPage = createLazyPage(
  () =>
    import('@/features/maintenance/pages/maintenance-record-detail-page').then((module) => ({
      default: module.MaintenanceRecordDetailPage,
    })),
  {
    title: 'Loading maintenance record',
    description: 'Preparing this service record detail.',
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
