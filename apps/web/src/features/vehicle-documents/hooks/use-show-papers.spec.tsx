import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { AttachmentKind, type VehicleDocument } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Attachment } from '@/features/attachments/types/attachment';
import { ApiError } from '@/lib/api/api-error';

import type { SavedPapers } from '../offline/saved-papers-store';

const live = vi.hoisted(() => ({
  vehicle: undefined as unknown,
  vehicleError: null as unknown,
  documents: undefined as VehicleDocument[] | undefined,
  attachments: [] as Attachment[],
}));
const store = vi.hoisted(() => ({
  readSavedPapers: vi.fn(),
  writeSavedPapers: vi.fn(),
  deleteSavedPapers: vi.fn(),
  savedPapersEpoch: vi.fn(() => 0),
}));
const getBlob = vi.hoisted(() => vi.fn());

vi.mock('../offline/saved-papers-store', () => store);
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => ({ data: live.vehicle, error: live.vehicleError }),
}));
vi.mock('./use-documents', () => ({
  useVehicleDocuments: () => ({ data: live.documents, error: null }),
}));
vi.mock('../api/document-attachments', () => ({
  getDocumentAttachments: async () => live.attachments,
}));
vi.mock('@/lib/api/api-client', () => ({ apiClient: { getBlob } }));

import { choosePapersView, useShowPapers } from './use-show-papers';

const VEHICLE = {
  id: 'vehicle-1',
  registrationNumber: 'MH12AB1234',
  make: 'Maruti Suzuki',
  model: 'Swift',
  variant: 'VXi',
  fuelType: 'petrol',
  currentUserRole: 'viewer',
};

const PUC: VehicleDocument = {
  id: 'puc-1',
  vehicleId: 'vehicle-1',
  kind: 'puc',
  provider: 'PUC Centre Baner',
  number: 'MH12-PUC-440192',
  startDate: new Date('2026-03-01T00:00:00.000Z'),
  endDate: new Date('2026-09-01T00:00:00.000Z'),
  notes: null,
  details: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const PDF: Attachment = {
  id: 'file-1',
  complianceDocumentId: 'puc-1',
  kind: AttachmentKind.Document,
  fileName: 'attachments/u/puc-1/puc.pdf',
  originalFileName: 'puc.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  url: '/api/attachments/file-1/file',
  uploadedAt: '2026-09-01T00:00:00.000Z',
};

function savedCopy(overrides: Partial<SavedPapers> = {}): SavedPapers {
  return {
    vehicleId: 'vehicle-1',
    userId: 'user-1',
    savedAt: '2026-09-20T04:44:00.000Z',
    signature: 'old',
    vehicle: { registrationNumber: 'MH12AB1234', electric: false, description: 'Swift · Petrol' },
    papers: [
      {
        id: 'puc-1',
        kind: 'puc',
        number: 'MH12-PUC-440192',
        provider: 'PUC Centre Baner',
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-09-01T00:00:00.000Z',
        files: [{ id: 'file-1', name: 'puc.pdf', mimeType: 'application/pdf', blob: null }],
      },
    ],
    ...overrides,
  };
}

/** A fresh cache per render of the hook, as a new visit to the page would have. */
function withCache() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

describe('useShowPapers', () => {
  beforeEach(() => {
    live.vehicle = VEHICLE;
    live.vehicleError = null;
    live.documents = [PUC];
    live.attachments = [PDF];
    store.readSavedPapers.mockResolvedValue(null);
    store.writeSavedPapers.mockResolvedValue(true);
    store.deleteSavedPapers.mockResolvedValue(undefined);
    store.savedPapersEpoch.mockReturnValue(0);
    getBlob.mockResolvedValue(new Blob(['%PDF']));
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('shows the papers live and keeps a copy on the device', async () => {
    const { result } = renderHook(() => useShowPapers('vehicle-1'), withCache());

    await waitFor(() => expect(store.writeSavedPapers).toHaveBeenCalled());
    const [record, epoch] = store.writeSavedPapers.mock.calls[0]!;
    expect(epoch).toBe(0);
    expect(record).toMatchObject({
      vehicleId: 'vehicle-1',
      userId: 'user-1',
      vehicle: {
        registrationNumber: 'MH12AB1234',
        description: 'Maruti Suzuki Swift VXi · Petrol',
      },
      papers: [{ id: 'puc-1', number: 'MH12-PUC-440192', files: [{ name: 'puc.pdf' }] }],
    });
    expect(record.papers[0].files[0].blob).toBeInstanceOf(Blob);

    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'ready',
        source: 'live',
        canEdit: false,
        savedAt: record.savedAt,
      }),
    );
  });

  it("only moves the time on when the papers haven't changed", async () => {
    const first = renderHook(() => useShowPapers('vehicle-1'), withCache());
    await waitFor(() => expect(store.writeSavedPapers).toHaveBeenCalledTimes(1));
    const [record] = store.writeSavedPapers.mock.calls[0]!;
    first.unmount();
    store.readSavedPapers.mockResolvedValue({ ...record, savedAt: '2026-09-01T00:00:00.000Z' });
    getBlob.mockClear();

    renderHook(() => useShowPapers('vehicle-1'), withCache());

    await waitFor(() => expect(store.writeSavedPapers).toHaveBeenCalledTimes(2));
    expect(getBlob).not.toHaveBeenCalled();
    expect(store.writeSavedPapers.mock.calls[1]![0].savedAt).not.toBe('2026-09-01T00:00:00.000Z');
  });

  it('opens the saved copy with no signal, and saves nothing', async () => {
    onlineManager.setOnline(false);
    live.vehicle = undefined;
    live.documents = undefined;
    store.readSavedPapers.mockResolvedValue(savedCopy());

    const { result } = renderHook(() => useShowPapers('vehicle-1'), withCache());

    await waitFor(() =>
      expect(result.current).toMatchObject({
        status: 'ready',
        source: 'saved',
        savedAt: '2026-09-20T04:44:00.000Z',
      }),
    );
    expect(store.readSavedPapers).toHaveBeenCalledWith('user-1', 'vehicle-1');
    expect(store.writeSavedPapers).not.toHaveBeenCalled();
  });

  it('forgets the copy of a vehicle no longer shared with the user', async () => {
    live.vehicle = undefined;
    live.vehicleError = new ApiError('Not found', 404);
    store.readSavedPapers.mockResolvedValue(savedCopy());

    const { result } = renderHook(() => useShowPapers('vehicle-1'), withCache());

    await waitFor(() => expect(result.current).toEqual({ status: 'gone' }));
    expect(store.deleteSavedPapers).toHaveBeenCalledWith('vehicle-1');
  });
});

describe('choosePapersView', () => {
  const livePapers = {
    vehicle: savedCopy().vehicle,
    papers: [],
    canEdit: true,
  };

  it('prefers live papers while online', () => {
    expect(
      choosePapersView({ online: true, live: livePapers, liveError: null, saved: savedCopy() }),
    ).toMatchObject({ source: 'live', savedAt: '2026-09-20T04:44:00.000Z' });
  });

  it('shows the saved copy while live ones load, or offline', () => {
    expect(
      choosePapersView({ online: true, live: null, liveError: null, saved: savedCopy() }),
    ).toMatchObject({ source: 'saved', canEdit: false });
    expect(
      choosePapersView({ online: false, live: livePapers, liveError: null, saved: savedCopy() }),
    ).toMatchObject({ source: 'saved' });
  });

  it('falls back to live papers still in memory when nothing was saved', () => {
    expect(
      choosePapersView({ online: false, live: livePapers, liveError: null, saved: null }),
    ).toMatchObject({ source: 'live', savedAt: null });
  });

  it('says why there is nothing to show', () => {
    expect(
      choosePapersView({ online: false, live: null, liveError: null, saved: null }),
    ).toMatchObject({ status: 'unavailable', offline: true });
    expect(
      choosePapersView({
        online: true,
        live: null,
        liveError: new TypeError('Failed to fetch'),
        saved: null,
      }),
    ).toMatchObject({ status: 'unavailable', offline: true });
    expect(
      choosePapersView({
        online: true,
        live: null,
        liveError: new ApiError('Something broke', 400),
        saved: null,
      }),
    ).toMatchObject({ status: 'unavailable', offline: false });
    expect(
      choosePapersView({ online: true, live: null, liveError: null, saved: undefined }),
    ).toEqual({ status: 'loading' });
  });

  it('never shows a saved copy of a vehicle the user has lost', () => {
    expect(
      choosePapersView({
        online: true,
        live: null,
        liveError: new ApiError('Forbidden', 403),
        saved: savedCopy(),
      }),
    ).toEqual({ status: 'gone' });
  });
});
