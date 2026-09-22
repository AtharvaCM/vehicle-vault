import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const DocumentCheckpointPage = createLazyPage(
  () =>
    import('@/features/vehicle-documents/pages/document-checkpoint-page').then((module) => ({
      default: module.DocumentCheckpointPage,
    })),
  {
    title: 'Loading document',
    description: 'Loading this document.',
  },
);

function VehicleDocumentRouteComponent() {
  const { documentId, kind, vehicleId } = vehicleDocumentRoute.useParams();

  return <DocumentCheckpointPage documentId={documentId} kind={kind} vehicleId={vehicleId} />;
}

export const vehicleDocumentRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/documents/$kind/$documentId',
  component: VehicleDocumentRouteComponent,
});
