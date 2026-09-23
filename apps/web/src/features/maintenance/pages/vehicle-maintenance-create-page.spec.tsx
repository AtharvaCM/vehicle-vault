import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VehicleRole } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appToast } from '@/lib/toast';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false, error: null }));
const navigate = vi.hoisted(() => vi.fn());
const createDraft = vi.hoisted(() => vi.fn());
const attachmentsApi = vi.hoisted(() => ({
  upload: vi.fn(),
  extract: vi.fn(),
  extractBatch: vi.fn(),
  apply: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { params?: Record<string, string>; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
}));

vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => vehicleQuery.current,
}));
vi.mock('../hooks/use-create-maintenance-record', () => ({ useCreateMaintenanceRecord: mutation }));
vi.mock('../hooks/use-create-maintenance-draft', () => ({
  useCreateMaintenanceDraft: () => ({ mutateAsync: createDraft, isPending: false, error: null }),
}));
vi.mock('@/features/attachments/api/upload-attachments', () => ({
  uploadAttachments: attachmentsApi.upload,
}));
vi.mock('@/features/attachments/api/extract-attachment', () => ({
  extractAttachment: attachmentsApi.extract,
}));
vi.mock('@/features/attachments/api/extract-attachments', () => ({
  extractAttachments: attachmentsApi.extractBatch,
}));
vi.mock('@/features/attachments/api/apply-attachment-extraction', () => ({
  applyAttachmentExtraction: attachmentsApi.apply,
}));
vi.mock('@/lib/toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/features/attachments/hooks/use-attachment-extraction-status', () => ({
  useAttachmentExtractionStatus: () => ({ data: { available: true } }),
}));
// Pulls in the router module, which the router mock above does not build.
vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
  useUnsavedChangesGuard: () => ({ allowNextNavigation: () => () => undefined }),
}));
vi.mock('../components/maintenance-form', () => ({
  MaintenanceForm: () => <div>maintenance form</div>,
}));
vi.mock('@/features/claims/components/maintenance-claim-link-card', () => ({
  MaintenanceClaimLinkCard: () => null,
}));

import { VehicleMaintenanceCreatePage } from './vehicle-maintenance-create-page';

function renderAs(role: VehicleRole) {
  vehicleQuery.current = {
    data: { id: 'vehicle-1', make: 'Bajaj', model: 'Pulsar NS 200', currentUserRole: role },
    isError: false,
  };

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <VehicleMaintenanceCreatePage vehicleId="vehicle-1" />
    </QueryClientProvider>,
  );
}

describe('VehicleMaintenanceCreatePage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('gives an %s the form', (role) => {
    renderAs(role);

    expect(screen.getByText('maintenance form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload job card first/i })).toBeInTheDocument();
    expect(screen.queryByText('You have view-only access')).not.toBeInTheDocument();
  });

  it('replaces the form with an explanation for a viewer', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.queryByText('maintenance form')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /upload job card first/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('You have view-only access')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to maintenance' })).toBeInTheDocument();
  });
});

describe('VehicleMaintenanceCreatePage upload-first', () => {
  const photo = new File(['bill'], 'bill.png', { type: 'image/png' });

  function uploadBill(files: File[] = [photo]) {
    renderAs(VehicleRole.Owner);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files } });
  }

  const opensDraft = () =>
    waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/maintenance-records/$recordId/edit',
        params: { recordId: 'draft-1' },
      }),
    );

  beforeEach(() => {
    createDraft.mockResolvedValue({ id: 'draft-1' });
    attachmentsApi.upload.mockResolvedValue([{ id: 'attachment-1' }]);
    attachmentsApi.apply.mockResolvedValue({ id: 'draft-1' });
  });

  it('fills the new draft from what the bill says before opening it', async () => {
    attachmentsApi.extract.mockResolvedValue({ status: 'completed', odometer: 32_150 });

    uploadBill();
    await opensDraft();

    expect(attachmentsApi.extract).toHaveBeenCalledWith('attachment-1');
    // Applied to the attachment on the draft just made, and only to it.
    expect(attachmentsApi.apply).toHaveBeenCalledTimes(1);
    expect(attachmentsApi.apply).toHaveBeenCalledWith('attachment-1');
    expect(attachmentsApi.apply.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0]!,
    );
  });

  it('reads several pages together and applies the merged result once', async () => {
    attachmentsApi.upload.mockResolvedValue([{ id: 'page-1' }, { id: 'page-2' }]);
    attachmentsApi.extractBatch.mockResolvedValue({ status: 'completed', totalCost: 1_520 });

    uploadBill([photo, new File(['page 2'], 'page-2.png', { type: 'image/png' })]);
    await opensDraft();

    expect(attachmentsApi.extractBatch).toHaveBeenCalledWith('draft-1', ['page-1', 'page-2']);
    expect(attachmentsApi.apply).toHaveBeenCalledWith('page-1');
  });

  it('opens the draft without applying when nothing could be read', async () => {
    attachmentsApi.extract.mockResolvedValue({ status: 'completed' });

    uploadBill();
    await opensDraft();

    expect(attachmentsApi.apply).not.toHaveBeenCalled();
  });

  it('opens the draft, and says so, when the bill could not be read', async () => {
    attachmentsApi.extract.mockRejectedValue(new Error('provider down'));

    uploadBill();
    await opensDraft();

    expect(attachmentsApi.apply).not.toHaveBeenCalled();
    expect(appToast.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Draft created, but the bill could not be read' }),
    );
  });
});
