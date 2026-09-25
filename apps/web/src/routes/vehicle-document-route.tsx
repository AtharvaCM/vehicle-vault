import {
  createRoute,
  redirect,
  useCanGoBack,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { VehicleDocumentKindSchema, type VehicleDocumentKind } from '@vehicle-vault/shared';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const ShowPapersPage = createLazyPage(
  () =>
    import('@/features/vehicle-documents/pages/show-papers-page').then((module) => ({
      default: module.ShowPapersPage,
    })),
  {
    title: 'Loading papers',
    description: "Loading this vehicle's papers.",
  },
);

export type ShowPapersSearch = {
  /** The paper whose tab is open. */
  paper?: VehicleDocumentKind;
  /** A particular document to show in its kind's tab, from an old per-document link. */
  document?: string;
};

export function normalizeShowPapersSearch(search: Record<string, unknown>): ShowPapersSearch {
  const paper = VehicleDocumentKindSchema.safeParse(search.paper);
  const document =
    typeof search.document === 'string' && search.document.length > 0 ? search.document : undefined;

  return {
    ...(paper.success ? { paper: paper.data } : {}),
    ...(document ? { document } : {}),
  };
}

function VehiclePapersRouteComponent() {
  const { vehicleId } = vehiclePapersRoute.useParams();
  const search = vehiclePapersRoute.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <ShowPapersPage
      documentId={search.document}
      onClose={() => {
        // Back to wherever it was opened from: Home, the garage or the vehicle.
        if (canGoBack) {
          router.history.back();
        } else {
          void navigate({
            to: '/vehicles/$vehicleId',
            params: { vehicleId },
            search: { tab: 'papers' },
          });
        }
      }}
      onPaperChange={(paper) => {
        void navigate({
          to: '/vehicles/$vehicleId/papers',
          params: { vehicleId },
          search: (previous) => ({ ...previous, paper }),
          replace: true,
        });
      }}
      paper={search.paper}
      vehicleId={vehicleId}
    />
  );
}

/** Show papers: every paper of one vehicle in one view, a tab each. */
export const vehiclePapersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/papers',
  validateSearch: normalizeShowPapersSearch,
  component: VehiclePapersRouteComponent,
});

/**
 * One document used to have a page of its own. Links to it live on in
 * bookmarks and shared messages, so it opens Show papers on that paper's tab,
 * showing that document, and replaces itself in the history.
 */
export const vehicleDocumentRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'vehicles/$vehicleId/documents/$kind/$documentId',
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/vehicles/$vehicleId/papers',
      params: { vehicleId: params.vehicleId },
      search: normalizeShowPapersSearch({ paper: params.kind, document: params.documentId }),
      replace: true,
    });
  },
});
