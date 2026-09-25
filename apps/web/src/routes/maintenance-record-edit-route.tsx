import { createRoute } from '@tanstack/react-router';

import { normalizeMaintenanceEditSearch } from '@/features/maintenance/types/maintenance-create-search';

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
  // Re-normalised: TanStack's search is non-strict and leaks unknown raw params.
  const search = normalizeMaintenanceEditSearch(maintenanceRecordEditRoute.useSearch());

  return <MaintenanceRecordEditPage recordId={recordId} reminderId={search.reminderId} />;
}

export const maintenanceRecordEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'maintenance-records/$recordId/edit',
  validateSearch: normalizeMaintenanceEditSearch,
  component: MaintenanceRecordEditRouteComponent,
});
