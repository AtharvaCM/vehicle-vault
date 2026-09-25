import {
  onlineManager,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { FuelType, type VehicleDocument, type VehicleDocumentKind } from '@vehicle-vault/shared';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type { Attachment } from '@/features/attachments/types/attachment';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useVehicle } from '@/features/vehicles/hooks/use-vehicle';
import type { Vehicle } from '@/features/vehicles/types/vehicle';
import { describeVehicleModel } from '@/features/vehicles/utils/describe-vehicle-model';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { queryKeys } from '@/lib/query/query-keys';

import { getDocumentAttachments } from '../api/document-attachments';
import {
  buildSavedPapers,
  papersSignature,
  type PaperWithFiles,
  type SavedVehicle,
} from '../offline/build-saved-papers';
import {
  deleteSavedPapers,
  readSavedPapers,
  savedPapersEpoch,
  writeSavedPapers,
  type SavedPaperFile,
  type SavedPapers,
} from '../offline/saved-papers-store';
import { papersToShow } from '../utils/papers-to-show';
import { attachmentBlobQueryOptions } from './use-attachment-object-url';
import { useVehicleDocuments } from './use-documents';

/** One file of a paper as the view shows it: live from the API, or the saved copy. */
export type ShownFile = {
  id: string;
  name: string;
  mimeType: string;
  /** Fetch it from the API. False: only `saved` is there. */
  live: boolean;
  /** The copy on this device, if one was kept. */
  saved: SavedPaperFile | null;
};

export type ShownPaper = {
  id: string;
  kind: VehicleDocumentKind;
  number: string | null;
  provider: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  /** Null while the list of files is still loading. */
  files: ShownFile[] | null;
};

export type PapersView =
  | { status: 'loading' }
  /** The vehicle is gone, or no longer shared with this user. */
  | { status: 'gone' }
  /** Nothing to show: no signal and no saved copy, or the API said no. */
  | { status: 'unavailable'; offline: boolean; message: string }
  | {
      status: 'ready';
      source: 'live' | 'saved';
      vehicle: SavedVehicle;
      papers: ShownPaper[];
      /** Whether the user can edit the vehicle, which is where papers and files are added. */
      canEdit: boolean;
      /** Live: whether this device holds a copy. Saved: when that copy was taken. */
      savedAt: string | null;
    };

type LivePapers = { vehicle: SavedVehicle; papers: ShownPaper[]; canEdit: boolean };

/** The API said this vehicle isn't there for this user; not a failure to reach it. */
export function isRefused(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

/** No answer at all, as opposed to an answer saying no. */
function isUnreachable(error: unknown) {
  return !(error instanceof ApiError) || error.status >= 500;
}

/**
 * Which papers to show. Live ones while there's signal to trust them; the
 * device's copy the moment it's read, while live ones load or when they can't;
 * live ones still in memory offline only when nothing was saved.
 */
export function choosePapersView({
  online,
  live,
  liveError,
  saved,
}: {
  online: boolean;
  live: LivePapers | null;
  liveError: unknown;
  /** Undefined until the device's copy has been looked for. */
  saved: SavedPapers | null | undefined;
}): PapersView {
  if (liveError && isRefused(liveError)) return { status: 'gone' };
  if (live && online) {
    return { status: 'ready', source: 'live', ...live, savedAt: saved?.savedAt ?? null };
  }
  if (saved) {
    return {
      status: 'ready',
      source: 'saved',
      vehicle: saved.vehicle,
      papers: saved.papers.map((paper) => ({
        ...paper,
        files: paper.files.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          live: false,
          saved: file,
        })),
      })),
      canEdit: false,
      savedAt: saved.savedAt,
    };
  }
  if (live) return { status: 'ready', source: 'live', ...live, savedAt: null };
  if (saved === undefined) return { status: 'loading' };
  if (!online || (liveError && isUnreachable(liveError))) {
    return {
      status: 'unavailable',
      offline: true,
      message:
        "There's no signal, and these papers aren't saved on this phone yet. Open them once with signal and they'll be here offline.",
    };
  }
  if (liveError) {
    return {
      status: 'unavailable',
      offline: false,
      message: getApiErrorMessage(liveError, "Couldn't load these papers."),
    };
  }
  return { status: 'loading' };
}

export function describeSavedVehicle(vehicle: Vehicle): SavedVehicle {
  return {
    registrationNumber: vehicle.registrationNumber,
    electric: vehicle.fuelType === FuelType.Electric,
    description: `${describeVehicleModel(vehicle)} · ${format.enumLabel('fuelType', vehicle.fuelType)}`,
  };
}

function subscribeOnline(onChange: () => void) {
  const unsubscribe = onlineManager.subscribe(onChange);
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    unsubscribe();
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const isOnline = () =>
  onlineManager.isOnline() && (typeof navigator === 'undefined' || navigator.onLine !== false);

export function useIsOnline() {
  return useSyncExternalStore(subscribeOnline, isOnline, () => true);
}

/** Structurally shared by useQueries, so an unchanged list keeps its identity. */
const dataOf = (results: { data?: Attachment[] }[]) => results.map((result) => result.data);

const savedPapersKey = (userId: string | null, vehicleId: string): QueryKey => [
  'savedPapers',
  userId,
  vehicleId,
];

/**
 * Every paper of one vehicle for Show papers, from the API or, with no signal,
 * from the copy this device keeps. Each time the papers load online the copy
 * is refreshed: the words and dates, a shrunk photo of each file, small PDFs.
 */
export function useShowPapers(vehicleId: string, requestedDocumentId?: string): PapersView {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const online = useIsOnline();
  const queryClient = useQueryClient();

  const vehicleQuery = useVehicle(vehicleId);
  const documentsQuery = useVehicleDocuments(vehicleId);
  const documents = useMemo<VehicleDocument[] | undefined>(
    () =>
      documentsQuery.data ? papersToShow(documentsQuery.data, requestedDocumentId) : undefined,
    [documentsQuery.data, requestedDocumentId],
  );
  const attachments = useQueries({
    queries: (documents ?? []).map((document) => ({
      queryKey: queryKeys.attachments.byDocument(document.kind, document.id),
      queryFn: () => getDocumentAttachments(document.kind, document.id),
    })),
    combine: dataOf,
  });

  const savedKey = useMemo(() => savedPapersKey(userId, vehicleId), [userId, vehicleId]);
  const savedQuery = useQuery({
    queryKey: savedKey,
    queryFn: () => readSavedPapers(userId!, vehicleId),
    enabled: userId !== null,
    // The device's own storage: there whether or not there's a network.
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
  });
  const saved = savedQuery.isFetched ? (savedQuery.data ?? null) : undefined;

  const liveVehicle = useMemo(
    () => (vehicleQuery.data ? describeSavedVehicle(vehicleQuery.data) : null),
    [vehicleQuery.data],
  );

  const withFiles = useMemo<PaperWithFiles[] | null>(() => {
    if (!documents || attachments.some((files) => files === undefined)) return null;
    return documents.map((document, index) => ({
      document,
      attachments: attachments[index]!,
    }));
  }, [documents, attachments]);
  const signature = liveVehicle && withFiles ? papersSignature(liveVehicle, withFiles) : null;
  const [savedSignature, setSavedSignature] = useState<string | null>(null);

  // Refresh the device's copy whenever the papers have loaded online.
  useEffect(() => {
    if (!online || !userId || !liveVehicle || !withFiles || !signature) return;
    if (!savedQuery.isFetched || savedSignature === signature) return;

    let cancelled = false;
    const startedIn = savedPapersEpoch();
    const previous = queryClient.getQueryData<SavedPapers | null>(savedKey) ?? null;

    void (async () => {
      const record: SavedPapers =
        previous && previous.signature === signature
          ? { ...previous, savedAt: new Date().toISOString() }
          : await buildSavedPapers({
              userId,
              vehicleId,
              vehicle: liveVehicle,
              papers: withFiles,
              previous,
              loadBlob: (attachmentId) =>
                queryClient.fetchQuery(attachmentBlobQueryOptions(attachmentId)),
            });
      if (cancelled) return;
      if ((await writeSavedPapers(record, startedIn)) && !cancelled) {
        queryClient.setQueryData(savedKey, record);
        setSavedSignature(signature);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    online,
    savedKey,
    userId,
    vehicleId,
    liveVehicle,
    withFiles,
    signature,
    savedSignature,
    savedQuery.isFetched,
    queryClient,
  ]);

  const liveError = vehicleQuery.error ?? documentsQuery.error;
  const refused = isRefused(liveError);

  // Access gone: nothing of this vehicle stays on the device.
  useEffect(() => {
    if (!refused) return;
    void deleteSavedPapers(vehicleId);
    queryClient.setQueryData(savedKey, null);
  }, [refused, vehicleId, savedKey, queryClient]);

  const live = useMemo<LivePapers | null>(() => {
    if (!liveVehicle || !documents) return null;
    const savedFiles = new Map(
      (saved?.papers ?? []).flatMap((paper) => paper.files.map((file) => [file.id, file])),
    );
    return {
      vehicle: liveVehicle,
      canEdit: vehicleQuery.data?.currentUserRole !== 'viewer',
      papers: documents.map((document, index) => ({
        id: document.id,
        kind: document.kind,
        number: document.number,
        provider: document.provider,
        startDate: document.startDate,
        endDate: document.endDate,
        files:
          attachments[index]?.map((attachment) => ({
            id: attachment.id,
            name: attachment.originalFileName,
            mimeType: attachment.mimeType,
            live: true,
            saved: savedFiles.get(attachment.id) ?? null,
          })) ?? null,
      })),
    };
  }, [liveVehicle, vehicleQuery.data, documents, attachments, saved]);

  return choosePapersView({ online, live, liveError, saved });
}
